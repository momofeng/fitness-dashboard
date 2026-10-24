import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyBackup, exportBackup, parseBackup, stripVolatile } from '../../src/db/backup/backup';
import { FitnessDB } from '../../src/db/db';
import { defaultSettings } from '../../src/db/defaults';

let db: FitnessDB;
let n = 0;

beforeEach(async () => {
  db = new FitnessDB(`test-${++n}-${Date.now()}`);
  await db.open();
});
afterEach(async () => {
  db.close();
  await db.delete();
});

async function seed(target: FitnessDB) {
  await target.settings.put({ ...defaultSettings(1000), onboarded: true });
  await target.bodyMetrics.bulkPut([
    { id: 'b1', date: '2026-10-01', weightKg: 70.2, bodyFatPct: 15, circ: { waist: 80 }, note: '', updatedAt: 1000 },
    { id: 'b2', date: '2026-10-02', weightKg: 70.4, bodyFatPct: null, circ: {}, note: '早上空腹', updatedAt: 1001 },
  ]);
  await target.workouts.put({
    id: 'w1',
    date: '2026-10-02',
    status: 'done',
    programId: null,
    dayId: null,
    dayName: '全身 A',
    plan: [],
    startedAt: 1000,
    endedAt: 2000,
    restEndsAt: null,
    notes: '',
    summary: null,
    updatedAt: 2000,
  });
  await target.sets.put({
    id: 's1',
    workoutId: 'w1',
    date: '2026-10-02',
    exerciseId: 'barbell-back-squat',
    order: 0,
    kind: 'working',
    weightKg: 60,
    reps: 5,
    rir: null,
    completedAt: 1500,
    updatedAt: 1500,
  });
  await target.dailyLogs.put({ date: '2026-10-02', waterMl: 2500, updatedAt: 1000 });
  await target.foodUsage.put({ foodKey: 'tfda:A0001', name: '雞胸肉', count: 3, lastUsedAt: 1000, lastQty: 150, lastUnit: 'g' });
}

describe('備份往返', () => {
  it('匯出 → 清空 → 匯入 → 再匯出，兩份一致', async () => {
    await seed(db);
    const first = await exportBackup(db, 'test', 1);
    const text = JSON.stringify(first);
    await Promise.all(db.tables.map((t) => t.clear()));
    expect(await db.bodyMetrics.count()).toBe(0);

    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await applyBackup(db, parsed.data, 'replace');
    const second = await exportBackup(db, 'test', 2);
    expect(stripVolatile(second)).toEqual(stripVolatile(first));
  });

  it('v1 fixture 可匯入', async () => {
    const text = readFileSync(new URL('../fixtures/backup-v1.json', import.meta.url), 'utf8');
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await applyBackup(db, parsed.data, 'replace');
    expect(await db.bodyMetrics.count()).toBe(parsed.counts.bodyMetrics);
    expect(parsed.counts.bodyMetrics).toBeGreaterThanOrEqual(14);
  });
});

describe('拒絕壞檔，資料庫不變', () => {
  const cases: Array<[string, string]> = [
    ['不是 JSON', '{oops'],
    ['不是本 App', JSON.stringify({ app: 'other', schemaVersion: 1, tables: {} })],
    ['版本太新', JSON.stringify({ app: 'fitness-dashboard', schemaVersion: 999, tables: {} })],
    ['缺版本', JSON.stringify({ app: 'fitness-dashboard', tables: {} })],
    ['資料表不是陣列', JSON.stringify({ app: 'fitness-dashboard', schemaVersion: 1, tables: { sets: {} } })],
    [
      '欄位錯誤',
      JSON.stringify({
        app: 'fitness-dashboard',
        schemaVersion: 1,
        tables: { bodyMetrics: [{ id: 'x', date: '2026-13-40', weightKg: 70, bodyFatPct: null, circ: {}, note: '', updatedAt: 1 }] },
      }),
    ],
    [
      '主鍵重複',
      JSON.stringify({
        app: 'fitness-dashboard',
        schemaVersion: 1,
        tables: {
          dailyLogs: [
            { date: '2026-10-01', waterMl: 1, updatedAt: 1 },
            { date: '2026-10-01', waterMl: 2, updatedAt: 1 },
          ],
        },
      }),
    ],
  ];

  it.each(cases)('%s', async (_name, text) => {
    await seed(db);
    const before = stripVolatile(await exportBackup(db, 'test'));
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(false);
    const after = stripVolatile(await exportBackup(db, 'test'));
    expect(after).toEqual(before);
  });

  it('欄位錯誤會指出表、第幾筆、哪個欄位', () => {
    const parsed = parseBackup(cases[5]![1]);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.issues[0]).toMatchObject({ table: 'bodyMetrics', index: 0, path: 'date' });
  });

  it('超過大小上限', () => {
    const parsed = parseBackup('{}', 60 * 1024 * 1024);
    expect(parsed.ok).toBe(false);
  });
});

describe('合併匯入', () => {
  it('updatedAt 較新者勝出', async () => {
    await seed(db);
    const backup = await exportBackup(db, 'test');
    // 本機的 b1 比備份新；備份的 b2 比本機新
    await db.bodyMetrics.update('b1', { weightKg: 71, updatedAt: 5000 });
    const tables = structuredClone(backup.tables);
    (tables.bodyMetrics[1] as { weightKg: number; updatedAt: number }).weightKg = 69;
    (tables.bodyMetrics[1] as { weightKg: number; updatedAt: number }).updatedAt = 9000;
    tables.bodyMetrics.push({ id: 'b3', date: '2026-10-03', weightKg: 70.6, bodyFatPct: null, circ: {}, note: '', updatedAt: 10 });
    const parsed = parseBackup(JSON.stringify({ ...backup, tables }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await applyBackup(db, parsed.data, 'merge');
    expect((await db.bodyMetrics.get('b1'))?.weightKg).toBe(71);
    expect((await db.bodyMetrics.get('b2'))?.weightKg).toBe(69);
    expect(await db.bodyMetrics.count()).toBe(3);
  });
});
