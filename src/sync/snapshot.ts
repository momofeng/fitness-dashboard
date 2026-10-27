import { db, SCHEMA_VERSION, type FitnessDB } from '../db/db';
import { BACKUP_SPECS, BACKUP_TABLES, type BackupTable } from '../db/backup/tables';
import { BACKUP_APP_ID, type BackupFile } from '../db/backup/backup';
import type { Settings, Workout, WorkoutSet } from '../db/schemas';
import { canonical, type SyncTables, type SyncRow } from '../core/syncMerge';

export const SYNC_TABLES = BACKUP_TABLES.filter((t) => t !== 'photos' && t !== 'foodUsage');
export const SYNC_SPECS = Object.fromEntries(SYNC_TABLES.map((t) => [t, BACKUP_SPECS[t]]));
function normalizeTables(tables: Record<BackupTable, unknown[]>): Record<BackupTable, unknown[]> {
  const out = structuredClone(tables);
  const allWorkoutIds = new Set((out.workouts as Workout[]).map((w) => w.id));
  if ((out.sets as WorkoutSet[]).some((s) => !allWorkoutIds.has(s.workoutId))) throw new Error('組數缺少所屬訓練場次，請先備份並修正後再同步');
  for (const [parent, child, key] of [['products', 'supplementLogs', 'productId'], ['habits', 'habitLogs', 'habitId']] as const) {
    const ids = new Set((out[parent] as SyncRow[]).map((r) => r.id));
    if ((out[child] as SyncRow[]).some((r) => !ids.has(r[key]))) throw new Error('打卡紀錄缺少所屬項目，請先備份並修正後再同步');
  }
  const done = new Set((out.workouts as Workout[]).filter((w) => w.status === 'done').map((w) => w.id));
  out.workouts = (out.workouts as Workout[]).filter((w) => done.has(w.id)).map((w) => ({ ...w, drafts: [] }));
  out.sets = (out.sets as WorkoutSet[]).filter((s) => done.has(s.workoutId));
  out.photos = []; out.foodUsage = [];
  out.settings = (out.settings as Settings[]).map((s) => ({ ...s, updatedAt: 0, theme: 'system',
    ai: { enabled: false, provider: null, model: null },
    backup: { lastExportAt: null, lastFullExportAt: null, remindDays: 7 },
    training: { ...s.training, keepAwake: true, sound: true, vibrate: true },
  }));
  for (const t of SYNC_TABLES) out[t].sort((a, b) => { const k = BACKUP_SPECS[t].key; const left = String((a as SyncRow)[k]), right = String((b as SyncRow)[k]); return left < right ? -1 : left > right ? 1 : 0; });
  return out;
}
export async function captureSnapshot(database: FitnessDB = db): Promise<BackupFile> {
  return database.transaction('r', SYNC_TABLES.map((t) => database.table(t)), async () => {
    const tables = Object.fromEntries(BACKUP_TABLES.map((t) => [t, []])) as unknown as Record<BackupTable, unknown[]>;
    for (const t of SYNC_TABLES) tables[t] = await database.table(t).orderBy(BACKUP_SPECS[t].key).toArray();
    return { app: BACKUP_APP_ID, schemaVersion: SCHEMA_VERSION, appVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'test', exportedAt: 0, includesPhotos: false, tables: normalizeTables(tables) };
  });
}
export function snapshotSignature(snapshot: BackupFile) { return canonical(snapshot.tables); }
export function asSyncTables(snapshot: BackupFile): SyncTables { return snapshot.tables as SyncTables; }
export function mergedSnapshot(template: BackupFile, tables: SyncTables): BackupFile {
  return { ...template, exportedAt: 0, includesPhotos: false, tables: { ...template.tables, ...tables, photos: [], foodUsage: [] } };
}
export async function validateSnapshot(raw: unknown): Promise<BackupFile> {
  if (!raw || typeof raw !== 'object' || !('tables' in raw) || !raw.tables || typeof raw.tables !== 'object' || SYNC_TABLES.some((t) => !Array.isArray((raw.tables as Record<string, unknown>)[t]))) throw new Error('雲端資料缺少必要資料表，沒有更動本機紀錄');
  const { parseBackup } = await import('../db/backup/import');
  const parsed = parseBackup(JSON.stringify(raw));
  if (!parsed.ok || parsed.data.includesPhotos) throw new Error('雲端資料格式不正確，沒有更動本機紀錄');
  if ((parsed.data.tables.workouts as Workout[]).some((w) => w.status !== 'done')) throw new Error('同步版本含進行中的訓練，請先完成該場訓練');
  const data = parsed.data;
  data.tables = normalizeTables(data.tables);
  return data;
}
export async function applySyncSnapshot(incoming: BackupFile, expected: BackupFile, database: FitnessDB = db, guard: () => void = () => undefined) {
  await database.transaction('rw', SYNC_TABLES.map((t) => database.table(t)), async () => {
    guard();
    const current = await captureSnapshot(database);
    if (snapshotSignature(current) !== snapshotSignature(expected)) throw new Error('本機紀錄剛剛有變動，請再同步一次');
    const active = await database.workouts.where('status').equals('active').toArray();
    const activeIds = new Set(active.map((w) => w.id));
    if ((incoming.tables.workouts as Workout[]).some((w) => activeIds.has(w.id))) throw new Error('本機有同一場進行中的訓練，請先完成或放棄後再同步');
    const activeSets = (await database.sets.toArray()).filter((s) => activeIds.has(s.workoutId));
    const localSettings = await database.settings.get('app');
    guard();
    for (const t of SYNC_TABLES) {
      let rows = structuredClone(incoming.tables[t]) as SyncRow[];
      if (t === 'settings' && localSettings) rows = rows.map((r) => {
        const s = r as unknown as Settings;
        return { ...s, updatedAt: Date.now(), theme: localSettings.theme, ai: localSettings.ai, backup: localSettings.backup,
          training: { ...s.training, keepAwake: localSettings.training.keepAwake, sound: localSettings.training.sound, vibrate: localSettings.training.vibrate } } as unknown as SyncRow;
      });
      if (t === 'settings' && rows.length === 0) continue;
      await database.table(t).clear();
      if (rows.length) await database.table(t).bulkPut(rows);
      if (t === 'workouts' && active.length) await database.workouts.bulkPut(active);
      if (t === 'sets' && activeSets.length) await database.sets.bulkPut(activeSets);
    }
    guard();
  });
}
