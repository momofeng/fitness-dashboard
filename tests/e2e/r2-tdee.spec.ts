// Round 2 自適應 TDEE：注入 21 天資料 → 建議 → 套用 → 目標熱量改變 → 回到公式。
import { expect, test } from '@playwright/test';
import { appDay, expectNoHorizontalOverflow, onboard, putRows, readAll } from './helpers';

const foodLog = (date: string, kcal: number, i: number) => ({
  id: `seed-f${i}`,
  date,
  meal: 'lunch',
  foodKey: null,
  name: '外食',
  qty: 1,
  unit: 'serving',
  per: { basis: 'perServing', kcal, protein: 120, fat: 80, carbs: 300 },
  kcal,
  protein: 120,
  fat: 80,
  carbs: 300,
  fiber: 0,
  sodium: 0,
  source: 'quick',
  createdAt: 1,
  updatedAt: 1,
});

test('自適應 TDEE：資料夠 → 建議下修（最多 150）→ 套用後目標改變 → 可回到公式', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await onboard(page);
  await page.goto('./#/eat/week');
  await expect(page.getByRole('region', { name: '自適應 TDEE' })).toContainText('完整飲食 0/14 天');

  // 過去 21 天每天 2700 kcal，體重每天 +0.05 kg（每週 +0.35）→ 估計約 2700 − 385 = 2315，比公式 2556 低
  const days = Array.from({ length: 21 }, (_, i) => appDay(-21 + i));
  await putRows(page, 'foodLogs', days.map((d, i) => foodLog(d, 2700, i)));
  await putRows(page, 'bodyMetrics', days.map((d, i) => ({ id: `body:${d}`, date: d, weightKg: Number((69 + 0.05 * i).toFixed(2)), bodyFatPct: null, circ: {}, note: '', updatedAt: 1 })));
  await page.reload();

  const card = page.getByRole('region', { name: '自適應 TDEE' });
  await expect(card).toContainText('目前用 公式 2,556 kcal');
  await expect(card).toContainText('估計每日消耗約');
  await expect(card).toContainText('2,405 kcal');
  await expectNoHorizontalOverflow(page, '每週營養（自適應 TDEE）');
  await card.getByRole('button', { name: '套用 2,405 kcal' }).click();
  await expect(card).toContainText('目前用 自適應 2,405 kcal');
  await expect(card).toContainText('上次調整不到一週');
  const s = (await readAll<{ nutrition: { tdeeOverride: number; tdeeAppliedAt: number } }>(page, 'settings'))[0]!;
  expect(s.nutrition.tdeeOverride).toBe(2405);

  // 首頁目標熱量 = 2405 + 盈餘（70 kg × 0.3% × 7700 ÷ 7 ≈ 231）
  await page.goto('./#/eat');
  await expect(page.getByText(/2,636/).first()).toBeVisible();

  await page.goto('./#/eat/week');
  await page.getByRole('button', { name: '回到公式估算' }).click();
  await expect(page.getByRole('region', { name: '自適應 TDEE' })).toContainText('目前用 公式 2,556 kcal');
});

test('飲食頁：標記這天記錄不完整', async ({ page }) => {
  await onboard(page);
  await putRows(page, 'foodLogs', [foodLog(appDay(), 900, 0)]);
  await page.goto('./#/eat');
  await page.reload();
  await page.getByRole('radio', { name: '不完整' }).click();
  const rows = await readAll<{ date: string; intakeComplete?: boolean }>(page, 'dailyLogs');
  expect(rows.find((r) => r.date === appDay())?.intakeComplete).toBe(false);
  await page.getByRole('radio', { name: '自動判斷' }).click();
  const after = await readAll<{ date: string; intakeComplete?: boolean }>(page, 'dailyLogs');
  expect(after.find((r) => r.date === appDay())?.intakeComplete).toBeUndefined();
});
