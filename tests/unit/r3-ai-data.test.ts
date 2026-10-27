// Round 3 資料層：AI 辨識結果 → 資料庫食物的對應、記住校正（aiMatches，Dexie v3）、批次寫入、v3 備份。

import { readFileSync } from 'node:fs';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { fragments, isExact, matchGuess } from '../../src/core/foodMatch';
import { normalizeText } from '../../src/core/search';
import { applyBackup, exportBackup } from '../../src/db/backup/backup';
import { parseBackup } from '../../src/db/backup/import';
import { exportZip, parseZip } from '../../src/db/backup/zip';
import { db, FitnessDB, STORES_V2 } from '../../src/db/db';
import { defaultSettings } from '../../src/db/defaults';
import { AI } from '../../src/db/limits';
import { rememberMatches } from '../../src/db/repo/aiMatches';
import { addFoodLogs, type FoodItem } from '../../src/db/repo/foods';

const fixture = (name: string) => new URL(`../fixtures/${name}`, import.meta.url);

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ ...defaultSettings(1), onboarded: true });
});

const food = (key: string, name: string, extra: Partial<FoodItem> = {}): FoodItem => ({
  key,
  name,
  aliases: [],
  sub: '',
  per: { basis: 'per100g', kcal: 100, protein: 10, fat: 5, carbs: 20 },
  servingG: null,
  servingLabel: '',
  source: 'tfda',
  rank: 0,
  ...extra,
});

describe('matchGuess：AI 名稱 → 資料庫食物', () => {
  const items = [
    food('tfda:rice', '白飯', { aliases: ['米飯'] }),
    food('tfda:chx', '去皮清肉(肉雞)', { aliases: ['雞胸肉', '去皮雞胸肉'] }),
    food('tfda:cab', '高麗菜'),
    food('tfda:egg1', '雞蛋(水煮)'),
    food('tfda:egg2', '雞蛋(水煮)', { sub: '另一筆' }),
    food('custom:mine', '我的雞肉飯', { source: 'custom' }),
  ];
  const byKey = (k: string) => items.find((i) => i.key === k);
  const none = new Map<string, string>();

  it('名稱完全相同 → 排第一且有把握', () => {
    const r = matchGuess({ name: '白飯' }, items, byKey, none);
    expect(r.candidates[0]!.item.key).toBe('tfda:rice');
    expect(r.candidates[0]!.via).toBe('name');
    expect(r.confident).toBe(true);
  });

  it('俗名完全相同也算（雞胸肉 → 正式名稱是去皮清肉(肉雞)）', () => {
    const r = matchGuess({ name: '雞胸肉' }, items, byKey, none);
    expect(r.candidates[0]!.item.key).toBe('tfda:chx');
    expect(r.confident).toBe(true);
  });

  it('主名稱對不上時用同義名；同義名的信任度較低、不算有把握', () => {
    const r = matchGuess({ name: '飯', altNames: ['白飯'] }, items, byKey, none);
    expect(r.candidates.some((c) => c.item.key === 'tfda:rice')).toBe(true);
    const viaAlt = matchGuess({ name: '煮熟的稻米', altNames: ['白飯'] }, items, byKey, none);
    expect(viaAlt.candidates[0]).toMatchObject({ via: 'alt' });
    expect(viaAlt.candidates[0]!.item.key).toBe('tfda:rice');
    expect(viaAlt.confident).toBe(false);
  });

  it('同樣好的選項有兩個以上（例如兩種樣品狀態）→ 不算有把握，但都列出來讓你選', () => {
    const r = matchGuess({ name: '雞蛋(水煮)' }, items, byKey, none);
    expect(r.candidates.slice(0, 2).map((c) => c.item.key).sort()).toEqual(['tfda:egg1', 'tfda:egg2']);
    expect(r.confident).toBe(false);
  });

  it('你校正過的對應優先於任何比對，且有把握', () => {
    const learned = new Map([[normalizeText('白飯'), 'custom:mine']]);
    const r = matchGuess({ name: '白飯' }, items, byKey, learned);
    expect(r.candidates[0]).toMatchObject({ via: 'learned' });
    expect(r.candidates[0]!.item.key).toBe('custom:mine');
    expect(r.confident).toBe(true);
    // 白飯本身仍在候選裡
    expect(r.candidates.some((c) => c.item.key === 'tfda:rice')).toBe(true);
  });

  it('校正指到已不存在的食物 → 忽略，照一般比對', () => {
    const r = matchGuess({ name: '白飯' }, items, byKey, new Map([[normalizeText('白飯'), 'custom:gone']]));
    expect(r.candidates[0]!.item.key).toBe('tfda:rice');
    expect(r.candidates[0]!.via).toBe('name');
  });

  it('完全沒結果時用名稱片段找（炒高麗菜 → 高麗菜），一律不算有把握', () => {
    expect(fragments('炒高麗菜').slice(0, 2)).toEqual(['高麗菜', '炒高麗']);
    const r = matchGuess({ name: '炒高麗菜' }, items, byKey, none);
    expect(r.candidates[0]).toMatchObject({ via: 'partial' });
    expect(r.candidates[0]!.item.key).toBe('tfda:cab');
    expect(r.confident).toBe(false);
  });

  it('什麼都對不上 → 空候選，不憑空捏造', () => {
    const r = matchGuess({ name: '龍蝦波士頓', altNames: ['xyz'] }, items, byKey, none);
    expect(r.candidates).toEqual([]);
    expect(r.confident).toBe(false);
  });

  it('只出現在樣品狀態成分字樣裡的詞不算「就是這個食物」（乳清蛋白 ≠ 優格）', () => {
    // 衛福部資料：aliases 為了搜尋混入了狀態字樣，exactAliases 只有真正的俗名
    const yogurt = food('tfda:yogurt', '高脂凝態發酵乳', { aliases: ['優格', '乳清蛋白'], exactAliases: ['優格'], state: '凝態,含乳清蛋白' });
    const items2 = [yogurt];
    const by2 = (k: string) => items2.find((i) => i.key === k);
    const whey = matchGuess({ name: '乳清蛋白' }, items2, by2, none);
    expect(whey.candidates[0]!.item.key).toBe('tfda:yogurt'); // 仍然列為候選，讓你自己判斷
    expect(whey.candidates[0]!.exact).toBe(false);
    expect(whey.confident).toBe(false);
    // 真正的俗名仍然算
    const real = matchGuess({ name: '優格' }, items2, by2, none);
    expect(real.candidates[0]!.exact).toBe(true);
    expect(real.confident).toBe(true);
    expect(isExact(yogurt, '高脂凝態發酵乳')).toBe(true);
  });

  it('只是「包含」不算完全相同（蘋果 ≠ 蘋果絲瓜）', () => {
    const loofah = food('tfda:loofah', '蘋果絲瓜');
    const r = matchGuess({ name: '蘋果' }, [loofah], (k) => (k === loofah.key ? loofah : undefined), none);
    expect(r.candidates[0]).toMatchObject({ via: 'name', exact: false });
    expect(r.confident).toBe(false);
  });

  it('煮熟的食物優先挑熟的樣品；沒煮的偏向生的', () => {
    const raw = food('tfda:egg-raw', '雞蛋', { state: '生', rank: 3 });
    const boiled = food('tfda:egg-boiled', '雞蛋', { state: '熟,水煮' });
    const both = [raw, boiled];
    const by = (k: string) => both.find((i) => i.key === k);
    expect(matchGuess({ name: '雞蛋', cooked: true }, both, by, none).candidates[0]!.item.key).toBe('tfda:egg-boiled');
    expect(matchGuess({ name: '雞蛋', cooked: false }, both, by, none).candidates[0]!.item.key).toBe('tfda:egg-raw');
    // 沒有 state（自建食物）不受影響
    const mine = food('custom:e', '雞蛋', { source: 'custom' });
    expect(matchGuess({ name: '雞蛋', cooked: true }, [mine], (k) => (k === mine.key ? mine : undefined), none).candidates).toHaveLength(1);
  });

  it('候選上限與使用次數加權', () => {
    const many = Array.from({ length: 12 }, (_, i) => food(`tfda:m${i}`, `牛奶${i}`));
    const r = matchGuess({ name: '牛奶' }, many, (k) => many.find((m) => m.key === k), none, { limit: 3 });
    expect(r.candidates).toHaveLength(3);
    const boosted = matchGuess({ name: '牛奶' }, many, (k) => many.find((m) => m.key === k), none, { boost: (i) => (i.key === 'tfda:m9' ? 50 : 0) });
    expect(boosted.candidates[0]!.item.key).toBe('tfda:m9');
  });
});

describe('rememberMatches：記住我的校正', () => {
  it('同食物累加次數；改成別的食物就取代並從 1 重算', async () => {
    await rememberMatches([{ name: ' 白　飯 ', foodKey: 'tfda:a' }]);
    await rememberMatches([{ name: '白飯', foodKey: 'tfda:a' }]);
    expect(await db.aiMatches.get('白飯')).toMatchObject({ foodKey: 'tfda:a', count: 2 });
    await rememberMatches([{ name: '白飯', foodKey: 'tfda:b' }]);
    expect(await db.aiMatches.get('白飯')).toMatchObject({ foodKey: 'tfda:b', count: 1 });
  });

  it('同一批裡同名只算最後一個（不會因為連續兩次 get→put 少算）', async () => {
    await rememberMatches([
      { name: '白飯', foodKey: 'tfda:a' },
      { name: '白飯', foodKey: 'tfda:b' },
    ]);
    expect(await db.aiMatches.count()).toBe(1);
    expect(await db.aiMatches.get('白飯')).toMatchObject({ foodKey: 'tfda:b', count: 1 });
  });

  it('超過上限刪掉最舊的', async () => {
    await db.aiMatches.bulkPut(Array.from({ length: AI.matchesMax }, (_, i) => ({ norm: `n${i}`, foodKey: 'tfda:x', count: 1, updatedAt: i + 1 })));
    await rememberMatches([
      { name: 'new1', foodKey: 'tfda:y' },
      { name: 'new2', foodKey: 'tfda:y' },
      { name: 'new3', foodKey: 'tfda:y' },
    ]);
    expect(await db.aiMatches.count()).toBe(AI.matchesMax);
    expect(await db.aiMatches.get('n0')).toBeUndefined();
    expect(await db.aiMatches.get('n2')).toBeUndefined();
    expect(await db.aiMatches.get('n3')).toBeDefined();
    expect(await db.aiMatches.get('new3')).toBeDefined();
  });

  it('空名稱或空 foodKey 不寫入', async () => {
    await rememberMatches([{ name: '  ', foodKey: 'tfda:a' }, { name: '白飯', foodKey: '' }]);
    expect(await db.aiMatches.count()).toBe(0);
  });
});

describe('addFoodLogs：批次寫入，營養 = 每 100 g 的值 × 克數 ÷ 100', () => {
  const chicken = food('tfda:chx', '雞胸肉', { per: { basis: 'per100g', kcal: 110, protein: 23.3, fat: 1.2, carbs: 0, sodium: 50 } });
  const rice = food('tfda:rice', '白飯', { per: { basis: 'per100g', kcal: 183, protein: 3.1, fat: 0.3, carbs: 40.4, fiber: 0.5 } });

  it('每筆的營養由資料庫數字依重量換算，來源是 ai', async () => {
    const rows = await addFoodLogs('2026-10-26', 'lunch', [
      { item: chicken, qty: 150, unit: 'g' },
      { item: rice, qty: 200, unit: 'g' },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ source: 'ai', meal: 'lunch', date: '2026-10-26', foodKey: 'tfda:chx', qty: 150, unit: 'g' });
    expect(rows[0]!.kcal).toBeCloseTo(165, 6);
    expect(rows[0]!.protein).toBeCloseTo(34.95, 6);
    expect(rows[1]!.kcal).toBeCloseTo(366, 6);
    expect(rows[1]!.carbs).toBeCloseTo(80.8, 6);
    expect(await db.foodLogs.count()).toBe(2);
    // 營養快照：記下當下的基準值
    expect((await db.foodLogs.get(rows[0]!.id))!.per).toEqual(chicken.per);
  });

  it('同一批裡同一食物出現兩次，常用食物次數正確累加', async () => {
    await addFoodLogs('2026-10-26', 'dinner', [
      { item: rice, qty: 100, unit: 'g' },
      { item: chicken, qty: 100, unit: 'g' },
      { item: rice, qty: 50, unit: 'g' },
    ]);
    expect(await db.foodUsage.get('tfda:rice')).toMatchObject({ count: 2, lastQty: 50, lastUnit: 'g' });
    expect(await db.foodUsage.get('tfda:chx')).toMatchObject({ count: 1 });
    await addFoodLogs('2026-10-26', 'dinner', [{ item: rice, qty: 80, unit: 'g' }]);
    expect(await db.foodUsage.get('tfda:rice')).toMatchObject({ count: 3, lastQty: 80 });
  });

  it('任何一筆無法換算 → 整批不寫（只有每份數值又不知道一份幾克時不能用克數）', async () => {
    const bar = food('custom:bar', '能量棒', { source: 'custom', per: { basis: 'perServing', kcal: 200, protein: 10, fat: 8, carbs: 25 } });
    await expect(
      addFoodLogs('2026-10-26', 'snack', [
        { item: rice, qty: 100, unit: 'g' },
        { item: bar, qty: 30, unit: 'g' },
      ]),
    ).rejects.toThrow('能量棒');
    expect(await db.foodLogs.count()).toBe(0);
    expect(await db.foodUsage.count()).toBe(0);
    // 改用「份」就可以
    const ok = await addFoodLogs('2026-10-26', 'snack', [{ item: bar, qty: 2, unit: 'serving' }]);
    expect(ok[0]!.kcal).toBe(400);
  });

  it('日期不合法 → 丟錯、不寫入', async () => {
    await expect(addFoodLogs('0026-01-01', 'lunch', [{ item: rice, qty: 100, unit: 'g' }])).rejects.toThrow();
    expect(await db.foodLogs.count()).toBe(0);
  });
});

describe('Dexie v2 → v3', () => {
  it('升級後資料都在，aiMatches 可用', async () => {
    const name = `upgrade-v3-${Date.now()}`;
    const old = new Dexie(name);
    old.version(1).stores({ ...STORES_V2 });
    old.version(2).stores({ ...STORES_V2 });
    await old.table('foodUsage').put({ foodKey: 'tfda:a', name: '白飯', count: 2, lastUsedAt: 5, lastQty: 100, lastUnit: 'g' });
    old.close();

    const upgraded = new FitnessDB(name);
    await upgraded.open();
    expect(upgraded.verno).toBe(4);
    expect(await upgraded.foodUsage.get('tfda:a')).toMatchObject({ count: 2 });
    expect(await upgraded.aiMatches.count()).toBe(0);
    await upgraded.aiMatches.put({ norm: '白飯', foodKey: 'tfda:a', count: 1, updatedAt: 1 });
    expect(await upgraded.aiMatches.orderBy('updatedAt').count()).toBe(1);
    upgraded.close();
    await upgraded.delete();
  });
});

describe('v3 備份', () => {
  it('v3 JSON fixture 可匯入，aiMatches 兩筆', async () => {
    const parsed = parseBackup(readFileSync(fixture('backup-v3.json'), 'utf8'));
    expect(parsed.ok, JSON.stringify(!parsed.ok && parsed.issues)).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.migratedFrom).toBe(3);
    expect(parsed.counts.aiMatches).toBe(2);
    await applyBackup(db, parsed.data, 'replace');
    expect(await db.aiMatches.get('雞胸肉')).toMatchObject({ foodKey: 'tfda:A0100101', count: 3 });
  });

  it('v3 ZIP fixture 可匯入，照片與 aiMatches 都在', async () => {
    const parsed = parseZip(new Uint8Array(readFileSync(fixture('backup-v3.zip'))));
    expect(parsed.ok, JSON.stringify(!parsed.ok && [parsed.errors, parsed.issues])).toBe(true);
    if (!parsed.ok) return;
    await applyBackup(db, parsed.data, 'replace', parsed.blobs);
    expect(await db.photos.count()).toBe(1);
    expect(await db.aiMatches.count()).toBe(2);
  });

  it('v2、v1 舊備份仍可匯入最新版（沒有 aiMatches 視為空）', () => {
    for (const f of ['backup-v2.json', 'backup-v1.json']) {
      const parsed = parseBackup(readFileSync(fixture(f), 'utf8'));
      expect(parsed.ok, `${f}：${JSON.stringify(!parsed.ok && parsed.issues)}`).toBe(true);
      if (parsed.ok) expect(parsed.counts.aiMatches).toBe(0);
    }
  });

  it('邊界值：寫得進去就還原得回來（名稱長度上限、次數、取代與合併）', async () => {
    await rememberMatches([{ name: '長'.repeat(AI.nameMax * 2), foodKey: 'custom:' + 'x'.repeat(90) }]);
    await rememberMatches([{ name: '白飯', foodKey: 'tfda:a' }]);
    const norms = (await db.aiMatches.toArray()).map((m) => m.norm.length);
    expect(Math.max(...norms)).toBe(AI.nameMax);

    const json = await exportBackup(db, 'test');
    expect(json.schemaVersion).toBe(4);
    const reparsed = parseBackup(JSON.stringify(json));
    expect(reparsed.ok, JSON.stringify(!reparsed.ok && reparsed.issues)).toBe(true);
    const zip = await exportZip(db, 'test');
    const zparsed = parseZip(new Uint8Array(await zip.blob.arrayBuffer()));
    expect(zparsed.ok).toBe(true);

    await Promise.all(db.tables.map((t) => t.clear()));
    if (!reparsed.ok) return;
    await applyBackup(db, reparsed.data, 'replace');
    expect(await db.aiMatches.count()).toBe(2);
    await applyBackup(db, reparsed.data, 'merge');
    expect(await db.aiMatches.count()).toBe(2);
  });

  it('驗證：超長名稱、次數 0、空 foodKey 會被擋下（整批拒絕）', () => {
    const env = (row: unknown) => JSON.stringify({ app: 'fitness-dashboard', schemaVersion: 3, includesPhotos: false, tables: { aiMatches: [row] } });
    const ok = { norm: 'a', foodKey: 'tfda:a', count: 1, updatedAt: 1 };
    expect(parseBackup(env(ok)).ok).toBe(true);
    expect(parseBackup(env({ ...ok, norm: 'a'.repeat(AI.nameMax + 1) })).ok).toBe(false);
    expect(parseBackup(env({ ...ok, count: 0 })).ok).toBe(false);
    expect(parseBackup(env({ ...ok, foodKey: '' })).ok).toBe(false);
  });
});
