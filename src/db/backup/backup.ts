// 匯出與寫入備份（不含 Zod）。匯入的解析與驗證在 import.ts：檢查大小 → 檢查版本 → 遷移 → 逐表 Zod 驗證
// （有一筆錯就整批拒絕）→ 由 UI 預覽並先自動匯出一份目前資料 → applyBackup 寫入（取代或合併）。
// 進度照：JSON 備份不含照片（includesPhotos=false，photos 表為空），匯入時完全不動手機上的照片；
// ZIP 完整備份（zip.ts）才含 photos 表與原圖。

import { SCHEMA_VERSION, type FitnessDB } from '../db';
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

export async function exportBackup(
  db: FitnessDB,
  appVersion: string,
  now = Date.now(),
  opts: { includePhotos?: boolean } = {},
): Promise<BackupFile> {
  const includePhotos = opts.includePhotos ?? false;
  const tables = {} as Record<BackupTable, unknown[]>;
  await db.transaction('r', BACKUP_TABLES.map((t) => db.table(t)), async () => {
    for (const t of BACKUP_TABLES) {
      if (t === 'photos' && !includePhotos) {
        tables[t] = [];
        continue;
      }
      const spec = BACKUP_SPECS[t];
      tables[t] = await db.table(t).orderBy(spec.key).toArray();
    }
  });
  return { app: BACKUP_APP_ID, schemaVersion: SCHEMA_VERSION, appVersion, exportedAt: now, includesPhotos: includePhotos, tables };
}

export function backupFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `fitness-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}

export type ImportMode = 'replace' | 'merge';

/**
 * 在單一 transaction 內寫入；任何錯誤都會讓整批回滾。
 * includesPhotos=false（JSON 備份）時不動 photos／photoBlobs；true（ZIP）時 photoBlobs 依 blobs 一併寫入。
 */
export async function applyBackup(
  db: FitnessDB,
  data: BackupFile,
  mode: ImportMode,
  blobs: Map<string, Blob> = new Map(),
): Promise<Record<BackupTable, number>> {
  const written = {} as Record<BackupTable, number>;
  const withPhotos = data.includesPhotos;
  const tableNames = BACKUP_TABLES.filter((t) => t !== 'photos' || withPhotos);
  const stores = [...tableNames.map((t) => db.table(t)), ...(withPhotos ? [db.photoBlobs] : [])];
  await db.transaction('rw', stores, async () => {
    if (withPhotos && mode === 'replace') await db.photoBlobs.clear();
    for (const t of BACKUP_TABLES) {
      if (t === 'photos' && !withPhotos) {
        written[t] = 0;
        continue;
      }
      const table = db.table(t);
      const rows = (data.tables[t] ?? []) as Array<Record<string, unknown>>;
      const spec = BACKUP_SPECS[t];
      const putBlobs = async (photoRows: Array<Record<string, unknown>>) => {
        if (t !== 'photos') return;
        const items = photoRows.map((r) => ({ id: r.id as string, blob: blobs.get(r.id as string) }));
        const missing = items.find((i) => !i.blob);
        if (missing) throw new Error(`缺少照片原圖：${missing.id}`);
        if (items.length) await db.photoBlobs.bulkPut(items as Array<{ id: string; blob: Blob }>);
      };
      // 備份裡沒有設定時保留目前的設定，避免還原後被導回首次設定
      if (mode === 'replace' && t === 'settings' && rows.length === 0) {
        written[t] = 0;
        continue;
      }
      if (mode === 'replace') {
        await table.clear();
        if (rows.length) await table.bulkPut(rows);
        await putBlobs(rows);
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
      await putBlobs(toPut);
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
