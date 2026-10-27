// Round 2 資料層：v1→v2 遷移、v2 fixture、邊界值往返、JSON／ZIP 備份與照片。

import { readFileSync } from 'node:fs';
import Dexie from 'dexie';
import { unzipSync, zipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { GOAL_TYPES, SORE_AREAS } from '../../src/content/types';
import { applyBackup, exportBackup, stripVolatile } from '../../src/db/backup/backup';
import { parseBackup } from '../../src/db/backup/import';
import { MIGRATIONS, migrateSettingsV1toV2 } from '../../src/db/backup/migrate';
import { exportZip, parseZip } from '../../src/db/backup/zip';
import { db, FitnessDB, STORES_V1 } from '../../src/db/db';
import { defaultSettings } from '../../src/db/defaults';
import { goalValueRange, LIMITS } from '../../src/db/limits';
import { saveGoal, saveHabit, toggleHabit, validateGoal } from '../../src/db/repo/goals';
import { addPhoto } from '../../src/db/repo/photos';
import { saveProduct, setCheckIn, type ProductInput } from '../../src/db/repo/products';
import { setDailyRecovery } from '../../src/db/repo/recovery';
import { updateSettings } from '../../src/db/repo/settings';
import { settingsSchema } from '../../src/db/schemas';

const fixture = (name: string) => new URL(`../fixtures/${name}`, import.meta.url);
const JPG = new Uint8Array(readFileSync(fixture('photo-16x12.jpg')));
const THUMB = `data:image/jpeg;base64,${Buffer.from(JPG).toString('base64')}`;
const jpegBlob = (size?: number) => {
  if (!size) return new Blob([JPG], { type: 'image/jpeg' });
  const b = new Uint8Array(size);
  b.set(JPG.subarray(0, 3));
  return new Blob([b], { type: 'image/jpeg' });
};

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ ...defaultSettings(1), onboarded: true });
});

function product(p: Partial<ProductInput> = {}): ProductInput {
  return {
    kind: 'supplement',
    name: '乳清',
    brand: '',
    category: 'protein',
    status: 'using',
    price: 1200,
    servingsPerContainer: 30,
    servingLabel: '1 匙',
    proteinPerServingG: 24,
    dailyServings: 1,
    containersBought: 1,
    adjustServings: 0,
    remindDays: 7,
    purchasedAt: null,
    note: '',
    ...p,
  };
}

async function expectRoundTrip(label: string) {
  const json = parseBackup(JSON.stringify(await exportBackup(db, 'test')));
  expect(json.ok, `${label} JSON：${JSON.stringify(!json.ok && json.issues)}`).toBe(true);
  const zip = await exportZip(db, 'test');
  const parsed = parseZip(new Uint8Array(await zip.blob.arrayBuffer()));
  expect(parsed.ok, `${label} ZIP：${JSON.stringify(!parsed.ok && [parsed.errors, parsed.issues])}`).toBe(true);
}

describe('v1 → v2 遷移', () => {
  it('v1 fixture 匯入後設定補齊新欄位、通過 v2 驗證', () => {
    const parsed = parseBackup(readFileSync(fixture('backup-v1.json'), 'utf8'));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.migratedFrom).toBe(1);
    const s = settingsSchema.parse(parsed.data.tables.settings[0]);
    expect(s.training.stallThresholdPct).toBe(1);
    expect(s.training.warmup.steps).toHaveLength(3);
    expect(s.equipment.ezBarKg).toBe(10);
    expect(s.recovery.deloadUntil).toBeNull();
    expect(s.nutrition.tdeeOverride).toBeNull();
    // 已有的值不動
    expect(s.equipment.plates).toHaveLength(5);
  });

  it('遷移不覆蓋已有的值', () => {
    const v2 = defaultSettings(5);
    v2.training.stallThresholdPct = 3;
    expect(migrateSettingsV1toV2(v2)).toEqual(v2);
  });

  it('Dexie 升級結果與備份遷移函式相同', async () => {
    const name = `upgrade-${Date.now()}`;
    const old = new Dexie(name);
    old.version(1).stores(STORES_V1);
    const v1 = JSON.parse(readFileSync(fixture('backup-v1.json'), 'utf8')).tables.settings[0];
    await old.table('settings').put(v1);
    await old.table('exercisesCustom').put({ id: 'x', nameZh: '測試', primary: ['chest'], updatedAt: 1 });
    old.close();

    const upgraded = new FitnessDB(name);
    await upgraded.open();
    // v1 → v2 → v3 依序升級（v3 只新增 aiMatches 表）
    expect(upgraded.verno).toBe(4);
    const row = await upgraded.settings.get('app');
    expect(row).toEqual(MIGRATIONS[1]!({ settings: [v1] }).settings![0]);
    expect(settingsSchema.safeParse(row).success).toBe(true);
    // 新索引可用
    expect(await upgraded.exercisesCustom.where('primary').equals('chest').count()).toBe(1);
    upgraded.close();
    await upgraded.delete();
  });
});

describe('v2 fixture', () => {
  it('JSON：可匯入，照片表為空', async () => {
    const parsed = parseBackup(readFileSync(fixture('backup-v2.json'), 'utf8'));
    expect(parsed.ok, JSON.stringify(!parsed.ok && parsed.issues)).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.counts.products).toBe(2);
    expect(parsed.counts.goals).toBe(2);
    expect(parsed.data.includesPhotos).toBe(false);
    await applyBackup(db, parsed.data, 'replace');
    expect(await db.supplementLogs.count()).toBe(3);
  });

  it('ZIP：可匯入，照片與原圖都在', async () => {
    const parsed = parseZip(new Uint8Array(readFileSync(fixture('backup-v2.zip'))));
    expect(parsed.ok, JSON.stringify(!parsed.ok && [parsed.errors, parsed.issues])).toBe(true);
    if (!parsed.ok) return;
    await applyBackup(db, parsed.data, 'replace', parsed.blobs);
    expect(await db.photos.count()).toBe(1);
    const blob = (await db.photoBlobs.get('fx-photo-1'))!.blob;
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(JPG);
  });
});

describe('邊界值：存得進去就還原得回來', () => {
  it('恢復、設定、產品、打卡、目標、習慣、照片的上下限', async () => {
    const [sLo, sHi] = LIMITS.sleepH;
    await setDailyRecovery('2026-10-01', { sleepHours: sLo, energy: LIMITS.energy[0], soreness: [...SORE_AREAS] });
    await setDailyRecovery('2026-10-02', { sleepHours: sHi, energy: LIMITS.energy[1] });

    const lo = <K extends keyof typeof LIMITS>(k: K) => LIMITS[k][0];
    const hi = <K extends keyof typeof LIMITS>(k: K) => LIMITS[k][1];
    await saveProduct(
      product({ price: lo('priceTwd'), servingsPerContainer: lo('servingsPerContainer'), proteinPerServingG: lo('proteinPerServingG'), dailyServings: lo('dailyServings'), containersBought: lo('containers'), adjustServings: lo('adjustServings'), remindDays: lo('remindDays') }),
    );
    const p = await saveProduct(
      product({ price: hi('priceTwd'), servingsPerContainer: hi('servingsPerContainer'), proteinPerServingG: hi('proteinPerServingG'), dailyServings: hi('dailyServings'), containersBought: hi('containers'), adjustServings: hi('adjustServings'), remindDays: hi('remindDays') }),
    );
    await saveProduct(product({ kind: 'gear', category: 'belt', price: null, servingsPerContainer: null, proteinPerServingG: null, dailyServings: null }));
    await setCheckIn(p.id, '2026-10-01', lo('logServings'));
    await setCheckIn(p.id, '2026-10-02', hi('logServings'));

    for (const type of GOAL_TYPES) {
      const [gLo, gHi] = goalValueRange(type);
      await saveGoal({
        type,
        title: `${type} 目標`,
        exerciseId: type === 'lift' ? 'barbell-back-squat' : null,
        targetReps: type === 'lift' ? hi('targetReps') : null,
        circ: type === 'circ' ? 'waist' : null,
        unit: '',
        startValue: gLo,
        targetValue: gHi,
        current: type === 'custom' ? gLo : null,
        dueDate: null,
      });
    }
    const h = await saveHabit({ name: '伸展', rule: 'manual', perWeek: lo('habitPerWeek') });
    await saveHabit({ name: '量體重', rule: 'weighIn', perWeek: hi('habitPerWeek') });
    await toggleHabit(h.id, '2026-10-01');

    await addPhoto({ date: '2026-10-01', pose: 'front', note: '', width: lo('photoPx'), height: lo('photoPx'), thumb: THUMB, blob: jpegBlob() });
    await addPhoto({ date: '2026-10-02', pose: 'back', note: 'x'.repeat(200), width: hi('photoPx'), height: hi('photoPx'), thumb: THUMB, blob: jpegBlob(hi('photoBytes')) });

    await db.exercisePrefs.put({ exerciseId: 'dumbbell-curl', repMin: 1, repMax: 100, updatedAt: 1 });

    await updateSettings({
      training: { stallThresholdPct: lo('stallThresholdPct'), warmup: { barReps: lo('warmupBarReps'), steps: [] } },
      equipment: { ezBarKg: lo('ezBarKg'), barLb: lo('barLb'), platesLb: [{ lb: lo('plateLb'), pairs: lo('platePairs') }] },
      nutrition: { tdeeOverride: lo('tdeeKcal'), tdeeAppliedAt: 1 },
      recovery: { lowSleepH: lo('lowSleepH'), lowEnergy: lo('lowEnergy'), deloadUntil: '2026-10-07', deloadSetsPct: lo('deloadSetsPct'), deloadWeightPct: lo('deloadWeightPct') },
      backup: { lastFullExportAt: 1 },
    });
    await expectRoundTrip('下限');

    await updateSettings({
      training: {
        stallThresholdPct: hi('stallThresholdPct'),
        warmup: { barReps: hi('warmupBarReps'), steps: Array.from({ length: hi('warmupSteps') }, () => ({ pct: hi('warmupPct'), reps: hi('warmupReps') })) },
      },
      equipment: { ezBarKg: hi('ezBarKg'), barLb: hi('barLb'), platesLb: [{ lb: hi('plateLb'), pairs: hi('platePairs') }] },
      nutrition: { tdeeOverride: hi('tdeeKcal') },
      recovery: { lowSleepH: hi('lowSleepH'), lowEnergy: hi('lowEnergy'), deloadSetsPct: hi('deloadSetsPct'), deloadWeightPct: hi('deloadWeightPct') },
    });
    await expectRoundTrip('上限');
  });

  it.each([
    ['睡眠 25 小時', () => setDailyRecovery('2026-10-05', { sleepHours: 25 })],
    ['睡眠 -1', () => setDailyRecovery('2026-10-05', { sleepHours: -1 })],
    ['精力 0', () => setDailyRecovery('2026-10-05', { energy: 0 })],
    ['精力 2.5', () => setDailyRecovery('2026-10-05', { energy: 2.5 })],
    ['價格 -1', () => saveProduct(product({ price: -1 }))],
    ['每罐 0 份', () => saveProduct(product({ servingsPerContainer: 0 }))],
    ['補給品類別配裝備', () => saveProduct(product({ category: 'belt' }))],
    ['打卡 0 份', () => setCheckIn('p', '2026-10-05', 0)],
    ['體重目標 7.5 kg', () => saveGoal({ type: 'bodyweight', title: 'x', exerciseId: null, targetReps: null, circ: null, unit: '', startValue: null, targetValue: 7.5, current: null, dueDate: null })],
    ['動作目標 13 下', () => saveGoal({ type: 'lift', title: 'x', exerciseId: 'barbell-back-squat', targetReps: 13, circ: null, unit: '', startValue: null, targetValue: 100, current: null, dueDate: null })],
    ['每週 8 次', () => saveHabit({ name: 'x', rule: 'manual', perWeek: 8 })],
    ['照片寬 2000', () => addPhoto({ date: '2026-10-05', pose: 'front', note: '', width: 2000, height: 100, thumb: THUMB, blob: jpegBlob() })],
    ['縮圖不是 JPEG', () => addPhoto({ date: '2026-10-05', pose: 'front', note: '', width: 10, height: 10, thumb: 'data:image/png;base64,AAAA', blob: jpegBlob() })],
  ])('超出範圍直接拒絕寫入：%s', async (_n, fn) => {
    const before = stripVolatile(await exportBackup(db, 'test', 0, { includePhotos: true }));
    await expect(fn()).rejects.toThrow(RangeError);
    expect(stripVolatile(await exportBackup(db, 'test', 0, { includePhotos: true }))).toEqual(before);
  });

  it('validateGoal：圍度目標要有部位', () => {
    expect(validateGoal({ type: 'circ', title: '腰圍', exerciseId: null, targetReps: null, circ: null, unit: '', startValue: null, targetValue: 80, current: null, dueDate: null })).toMatch(/部位/);
  });
});

describe('照片與備份', () => {
  async function seedPhoto() {
    return addPhoto({ date: '2026-10-03', pose: 'side', note: '測試', width: 16, height: 12, thumb: THUMB, blob: jpegBlob() });
  }

  it('JSON 備份不含照片；取代還原保留手機上的照片', async () => {
    const photo = await seedPhoto();
    const backup = await exportBackup(db, 'test');
    expect(backup.includesPhotos).toBe(false);
    expect(backup.tables.photos).toEqual([]);
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await applyBackup(db, parsed.data, 'replace');
    expect(await db.photos.get(photo.id)).toBeTruthy();
    expect(await db.photoBlobs.get(photo.id)).toBeTruthy();
  });

  it('JSON 裡標示含照片 → 要求改選 ZIP', () => {
    const parsed = parseBackup(JSON.stringify({ app: 'fitness-dashboard', schemaVersion: 2, includesPhotos: true, tables: {} }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors[0]).toMatch(/ZIP/);
  });

  it('ZIP 往返：清空後還原，資料與原圖位元組都相同', async () => {
    await seedPhoto();
    await saveProduct(product());
    const first = await exportBackup(db, 'test', 1, { includePhotos: true });
    const zip = await exportZip(db, 'test', 1);
    expect(zip.photos).toBe(1);
    await Promise.all(db.tables.map((t) => t.clear()));

    const parsed = parseZip(new Uint8Array(await zip.blob.arrayBuffer()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await applyBackup(db, parsed.data, 'replace', parsed.blobs);
    const second = await exportBackup(db, 'test', 1, { includePhotos: true });
    expect(stripVolatile(second)).toEqual(stripVolatile(first));
    const blob = (await db.photoBlobs.toArray())[0]!.blob;
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(JPG);
  });

  it('ZIP 取代還原會換掉手機上原本的照片', async () => {
    const old = await seedPhoto();
    const parsed = parseZip(new Uint8Array(readFileSync(fixture('backup-v2.zip'))));
    if (!parsed.ok) throw new Error('fixture 應該可以解析');
    await applyBackup(db, parsed.data, 'replace', parsed.blobs);
    expect(await db.photos.get(old.id)).toBeUndefined();
    expect(await db.photoBlobs.get(old.id)).toBeUndefined();
    expect(await db.photoBlobs.count()).toBe(1);
  });

  const zipOf = (files: Record<string, Uint8Array>) => zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, [v, { level: 0 }]])));
  const goodZip = () => unzipSync(new Uint8Array(readFileSync(fixture('backup-v2.zip'))));

  it.each([
    ['不是 ZIP', () => new TextEncoder().encode('hello')],
    ['沒有 backup.json', () => zipOf({ 'photos/fx-photo-1.jpg': JPG })],
    ['缺原圖', () => zipOf({ 'backup.json': goodZip()['backup.json']! })],
    ['原圖不是 JPEG', () => zipOf({ 'backup.json': goodZip()['backup.json']!, 'photos/fx-photo-1.jpg': new TextEncoder().encode('not a jpeg') })],
    [
      '版本太新',
      () => {
        const z = goodZip();
        const env = JSON.parse(new TextDecoder().decode(z['backup.json']));
        env.schemaVersion = 99;
        return zipOf({ ...z, 'backup.json': new TextEncoder().encode(JSON.stringify(env)) });
      },
    ],
    [
      '照片資料錯誤',
      () => {
        const z = goodZip();
        const env = JSON.parse(new TextDecoder().decode(z['backup.json']));
        env.tables.photos[0].width = 5000;
        return zipOf({ ...z, 'backup.json': new TextEncoder().encode(JSON.stringify(env)) });
      },
    ],
  ])('壞 ZIP 被拒絕、資料庫不變：%s', async (_n, make) => {
    await seedPhoto();
    const before = stripVolatile(await exportBackup(db, 'test', 0, { includePhotos: true }));
    const parsed = parseZip(make());
    expect(parsed.ok).toBe(false);
    expect(stripVolatile(await exportBackup(db, 'test', 0, { includePhotos: true }))).toEqual(before);
    expect(await db.photoBlobs.count()).toBe(1);
  });
});
