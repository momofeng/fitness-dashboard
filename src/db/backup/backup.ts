// 匯出與匯入備份。流程：檢查大小 → 檢查版本 → 遷移 → 逐表 Zod 驗證（有一筆錯就整批拒絕）
// → 由 UI 預覽並先自動匯出一份目前資料 → applyBackup 寫入（取代或合併）。

import { SCHEMA_VERSION, type FitnessDB } from '../db';
import { migrateTables, type RawTables } from './migrate';
import { BACKUP_SPECS, BACKUP_TABLES, type BackupTable } from './tables';

export const BACKUP_APP_ID = 'fitness-dashboard';
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  appVersion: string;
  exportedAt: number;
  includesPhotos: boolean;
  tables: Record<BackupTable, unknown[]>;
}

export async function exportBackup(db: FitnessDB, appVersion: string, now = Date.now()): Promise<BackupFile> {
  const tables = {} as Record<BackupTable, unknown[]>;
  await db.transaction('r', BACKUP_TABLES.map((t) => db.table(t)), async () => {
    for (const t of BACKUP_TABLES) {
      const spec = BACKUP_SPECS[t];
      tables[t] = await db.table(t).orderBy(spec.key).toArray();
    }
  });
  return { app: BACKUP_APP_ID, schemaVersion: SCHEMA_VERSION, appVersion, exportedAt: now, includesPhotos: false, tables };
}

export function backupFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `fitness-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}

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

export function parseBackup(text: string, byteLength = new Blob([text]).size): ParseResult {
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
    const rows = tables[t] ?? [];
    const parsed: unknown[] = [];
    const seen = new Set<unknown>();
    rows.forEach((row, index) => {
      const r = spec.schema.safeParse(row);
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
      includesPhotos: false,
      tables: out,
    },
    counts,
    migratedFrom: version < SCHEMA_VERSION ? version : null,
  };
}

export type ImportMode = 'replace' | 'merge';

/** 在單一 transaction 內寫入；任何錯誤都會讓整批回滾 */
export async function applyBackup(
  db: FitnessDB,
  data: BackupFile,
  mode: ImportMode,
): Promise<Record<BackupTable, number>> {
  const written = {} as Record<BackupTable, number>;
  await db.transaction('rw', BACKUP_TABLES.map((t) => db.table(t)), async () => {
    for (const t of BACKUP_TABLES) {
      const table = db.table(t);
      const rows = (data.tables[t] ?? []) as Array<Record<string, unknown>>;
      const spec = BACKUP_SPECS[t];
      if (mode === 'replace') {
        await table.clear();
        if (rows.length) await table.bulkPut(rows);
        written[t] = rows.length;
        continue;
      }
      const keys = rows.map((r) => r[spec.key]) as string[];
      const existing = (await table.bulkGet(keys)) as Array<Record<string, unknown> | undefined>;
      const toPut = rows.filter((r, i) => {
        const cur = existing[i];
        return !cur || Number(r[spec.stamp] ?? 0) >= Number(cur[spec.stamp] ?? 0);
      });
      if (toPut.length) await table.bulkPut(toPut);
      written[t] = toPut.length;
    }
  });
  return written;
}

/** 回歸測試用：去掉 exportedAt 後比較兩份備份 */
export function stripVolatile(b: BackupFile): Omit<BackupFile, 'exportedAt'> {
  const { exportedAt: _ignored, ...rest } = b;
  return rest;
}
