// 解析與驗證備份檔（會載入 Zod）。

import { SCHEMA_VERSION } from '../db';
import { BACKUP_APP_ID, MAX_BACKUP_BYTES, type BackupFile } from './backup';
import { migrateTables, type RawTables } from './migrate';
import { BACKUP_SPECS, BACKUP_TABLES, type BackupTable } from './tables';
import { BACKUP_SCHEMAS } from './validate';

export interface ImportIssue {
  table: string;
  index: number;
  path: string;
  message: string;
}

export type ParseResult =
  | { ok: true; data: BackupFile; counts: Record<BackupTable, number>; migratedFrom: number | null }
  | { ok: false; errors: string[]; issues: ImportIssue[] };

const MAX_ISSUES = 20;

export interface ParseOptions {
  /** ZIP 裡有原圖的照片 id；JSON 匯入時不給 */
  photoIds?: Set<string>;
}

export function parseBackup(text: string, byteLength = new Blob([text]).size, opts: ParseOptions = {}): ParseResult {
  const fail = (msg: string, issues: ImportIssue[] = []): ParseResult => ({ ok: false, errors: [msg], issues });
  if (byteLength > MAX_BACKUP_BYTES) return fail(`檔案超過 ${MAX_BACKUP_BYTES / 1024 / 1024} MB 上限。`);

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('不是有效的 JSON 檔。');
  }
  if (!raw || typeof raw !== 'object') return fail('檔案內容不是備份格式。');
  const env = raw as Record<string, unknown>;
  if (env.app !== BACKUP_APP_ID) return fail('這不是本 App 的備份檔。');
  const version = env.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return fail('備份檔缺少版本資訊。');
  if (version > SCHEMA_VERSION) return fail(`備份檔版本 v${version} 比 App 新（v${SCHEMA_VERSION}），請先更新 App。`);
  if (!env.tables || typeof env.tables !== 'object' || Array.isArray(env.tables)) return fail('備份檔缺少資料表。');

  const includesPhotos = env.includesPhotos === true;
  if (includesPhotos && !opts.photoIds) return fail('這份資料含進度照，請改選 ZIP 完整備份檔。');

  let tables = env.tables as RawTables;
  for (const [name, rows] of Object.entries(tables)) {
    if (!Array.isArray(rows)) return fail(`資料表「${name}」格式錯誤。`);
  }
  try {
    tables = migrateTables(tables, version, SCHEMA_VERSION);
  } catch (e) {
    return fail(e instanceof Error ? e.message : '版本遷移失敗。');
  }

  const issues: ImportIssue[] = [];
  const out = {} as Record<BackupTable, unknown[]>;
  const counts = {} as Record<BackupTable, number>;
  for (const t of BACKUP_TABLES) {
    const spec = BACKUP_SPECS[t];
    // JSON 備份不含照片：不讀 photos 表，匯入時也不會動手機上的照片
    const rows = t === 'photos' && !includesPhotos ? [] : (tables[t] ?? []);
    const parsed: unknown[] = [];
    const seen = new Set<unknown>();
    rows.forEach((row, index) => {
      const r = BACKUP_SCHEMAS[t].safeParse(row);
      if (!r.success) {
        for (const iss of r.error.issues) {
          if (issues.length < MAX_ISSUES) {
            issues.push({ table: t, index, path: iss.path.join('.') || '(整筆)', message: iss.message });
          }
        }
        return;
      }
      const key = (r.data as Record<string, unknown>)[spec.key];
      if (seen.has(key)) {
        if (issues.length < MAX_ISSUES) issues.push({ table: t, index, path: spec.key, message: '主鍵重複' });
        return;
      }
      seen.add(key);
      if (t === 'photos' && !opts.photoIds?.has(key as string)) {
        if (issues.length < MAX_ISSUES) issues.push({ table: t, index, path: 'id', message: 'ZIP 裡找不到這張照片的原圖' });
        return;
      }
      parsed.push(r.data);
    });
    out[t] = parsed;
    counts[t] = parsed.length;
  }
  if (issues.length > 0) {
    return { ok: false, errors: ['備份檔有資料格式錯誤，已整批拒絕，資料庫沒有任何變動。'], issues };
  }
  if ((out.settings?.length ?? 0) > 1) return fail('設定資料只能有一筆。');

  return {
    ok: true,
    data: {
      app: BACKUP_APP_ID,
      schemaVersion: SCHEMA_VERSION,
      appVersion: typeof env.appVersion === 'string' ? env.appVersion : '',
      exportedAt: typeof env.exportedAt === 'number' ? env.exportedAt : 0,
      includesPhotos,
      tables: out,
    },
    counts,
    migratedFrom: version < SCHEMA_VERSION ? version : null,
  };
}

