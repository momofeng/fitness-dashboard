// Round 2 我的產品：打卡（一天一筆、合併匯入不重複）、補貨、刪除可復原。

import { beforeEach, describe, expect, it } from 'vitest';
import { applyBackup, exportBackup } from '../../src/db/backup/backup';
import { parseBackup } from '../../src/db/backup/import';
import { db } from '../../src/db/db';
import { defaultSettings } from '../../src/db/defaults';
import { consumedByProduct, deleteProduct, restock, restoreProduct, saveProduct, setCheckIn, supplementLogId } from '../../src/db/repo/products';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ ...defaultSettings(1), onboarded: true });
});

const whey = () =>
  saveProduct({
    kind: 'supplement',
    name: '乳清',
    brand: '',
    category: 'protein',
    status: 'using',
    price: 1200,
    servingsPerContainer: 30,
    servingLabel: '',
    proteinPerServingG: 24,
    dailyServings: 1,
    containersBought: 1,
    adjustServings: 0,
    remindDays: 7,
    purchasedAt: null,
    note: '',
  });

describe('補給品打卡', () => {
  it('同一天只有一筆；改份數是更新、null 是取消', async () => {
    const p = await whey();
    await setCheckIn(p.id, '2026-10-01', 1);
    await setCheckIn(p.id, '2026-10-01', 2);
    expect(await db.supplementLogs.count()).toBe(1);
    expect((await consumedByProduct()).get(p.id)).toBe(2);
    await setCheckIn(p.id, '2026-10-01', null);
    expect(await db.supplementLogs.count()).toBe(0);
  });

  it('合併匯入同一天的打卡不會變兩筆', async () => {
    const p = await whey();
    await setCheckIn(p.id, '2026-10-01', 1);
    const backup = await exportBackup(db, 'test');
    await setCheckIn(p.id, '2026-10-01', 1.5);
    const parsed = parseBackup(JSON.stringify(backup));
    if (!parsed.ok) throw new Error('backup should parse');
    await applyBackup(db, parsed.data, 'merge');
    expect(await db.supplementLogs.count()).toBe(1);
    // 本機較新，保留本機
    expect((await db.supplementLogs.get(supplementLogId(p.id, '2026-10-01')))?.servings).toBe(1.5);
  });
});

describe('補貨與刪除', () => {
  it('補貨一罐：罐數 +1、狀態改回使用中', async () => {
    const p = await whey();
    await db.products.update(p.id, { status: 'finished' });
    await restock(p.id);
    expect(await db.products.get(p.id)).toMatchObject({ containersBought: 2, status: 'using' });
  });

  it('刪除產品連同打卡，復原後都回來', async () => {
    const p = await whey();
    await setCheckIn(p.id, '2026-10-01', 1);
    await setCheckIn(p.id, '2026-10-02', 1);
    const removed = await deleteProduct(p.id);
    expect(await db.products.count()).toBe(0);
    expect(await db.supplementLogs.count()).toBe(0);
    await restoreProduct(removed!);
    expect(await db.products.count()).toBe(1);
    expect(await db.supplementLogs.count()).toBe(2);
  });
});
