// Round 2 選品：知識卡（來源連結）、我的補給品（成本、打卡、庫存、補貨提醒、CP 值比較）、裝備。
import { expect, test } from '@playwright/test';
import { appDay, doneWorkout, expectNoHorizontalOverflow, onboard, putRows, readAll } from './helpers';

test('知識卡：依等級篩選、每條宣稱可展開來源、加到我的補給品', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await onboard(page);
  await page.goto('./#/supplements');
  await page.getByRole('radio', { name: 'D 級' }).click();
  await expect(page.getByRole('link', { name: /麩醯胺酸/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /肌酸/ })).toHaveCount(0);
  await page.getByRole('radio', { name: '全部' }).click();
  await expectNoHorizontalOverflow(page, '知識卡列表');
  await page.getByRole('link', { name: /^證據 A\s*肌酸/ }).click();
  await expect(page.getByRole('heading', { name: '肌酸' })).toBeVisible();
  await expect(page.getByText('證據 A')).toBeVisible();
  await page.getByRole('button', { name: /來源（/ }).first().click();
  const link = page.getByRole('link', { name: /ISSN 立場聲明：肌酸/ }).first();
  await expect(link).toHaveAttribute('href', /^https:\/\/(pubmed\.ncbi\.nlm\.nih\.gov|doi\.org)\//);
  await expect(page.getByText(/不是醫療建議/).first()).toBeVisible();
  await expectNoHorizontalOverflow(page, '知識卡內頁');

  await page.getByRole('button', { name: /加到我的補給品/ }).click();
  await expect(page).toHaveURL(/#\/products/);
  await expect(page.getByLabel('名稱')).toHaveValue('肌酸');
  await expect(page.getByLabel('類別')).toHaveValue('creatine');
});

test('我的補給品：每克蛋白質成本、打卡扣庫存、補貨提醒、CP 值比較', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await onboard(page);
  await page.goto('./#/products');
  await page.getByRole('button', { name: '新增' }).click();
  await page.getByLabel('名稱').fill('乳清 A');
  await page.getByLabel('每罐價格').fill('1200');
  await page.getByLabel('每罐份數').fill('30');
  await page.getByLabel('每份蛋白質').fill('24');
  await page.getByLabel('庫存校正').fill('-22');
  await page.getByRole('button', { name: '儲存' }).click();

  const card = page.getByRole('region', { name: '乳清 A' });
  await expect(card).toContainText('NT$40');
  await expect(card).toContainText('NT$1.67');
  await expect(card).toContainText('剩 8 份，約 8 天');
  await expect(card.getByRole('status')).toHaveCount(0);
  await card.getByRole('button', { name: '今天打卡' }).click();
  await expect(card).toContainText('剩 7 份，約 7 天');
  await expect(card.getByRole('status')).toContainText('該補貨了');
  await card.getByRole('button', { name: '補貨一罐' }).click();
  await expect(card).toContainText('剩 37 份');
  await expect(card.getByRole('status')).toHaveCount(0);
  const logs = await readAll<{ date: string; servings: number }>(page, 'supplementLogs');
  expect(logs).toEqual([expect.objectContaining({ date: appDay(), servings: 1 })]);

  // 考慮中的產品一起比價
  await page.getByRole('button', { name: '新增' }).click();
  await page.getByLabel('名稱').fill('乳清 B 5 磅');
  await page.getByRole('radio', { name: '考慮中' }).click();
  await page.getByLabel('每罐價格').fill('2400');
  await page.getByLabel('每罐份數').fill('80');
  await page.getByLabel('每份蛋白質').fill('25');
  await page.getByRole('button', { name: '儲存' }).click();
  const cmp = page.getByRole('region', { name: '蛋白粉 CP 值比較' });
  await expect(cmp.getByRole('listitem').first()).toContainText('乳清 B 5 磅');
  await expect(cmp.getByRole('listitem').first()).toContainText('NT$1.2');
  await expect(cmp.getByRole('listitem').nth(1)).toContainText('+39%');
  await expectNoHorizontalOverflow(page, '我的補給品');

  // 打錯價格：標紅、不能儲存
  await page.getByRole('button', { name: '編輯 乳清 A' }).click();
  await page.getByLabel('每罐份數').fill('0');
  await page.getByLabel('每罐份數').blur();
  await expect(page.getByLabel('每罐份數')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: '儲存' })).toBeDisabled();
  await page.keyboard.press('Escape');

  // 首頁今日打卡顯示使用中的補給品（已打卡）
  await page.goto('./#/');
  await expect(page.getByRole('region', { name: '今日打卡' }).getByRole('button', { name: '補給品：乳清 A' })).toHaveAttribute('aria-pressed', 'true');
});

test('裝備：每次訓練成本', async ({ page }) => {
  await onboard(page);
  const seeds = [-5, -3, -1].map((d, i) => doneWorkout(`seed-w${i}`, appDay(d), 'barbell-back-squat', 60, [5], Date.now() - (6 - i) * 86400_000));
  await putRows(page, 'workouts', seeds.map((s) => s.workout));
  await page.goto('./#/products');
  await page.reload();
  await page.getByRole('radio', { name: '裝備' }).click();
  await page.getByRole('button', { name: '新增' }).click();
  await page.getByLabel('名稱').fill('舉重腰帶');
  await page.getByLabel('價格').fill('1500');
  await page.getByLabel('購買日期').fill(appDay(-4));
  await page.getByRole('button', { name: '儲存' }).click();
  // 購買後完成 2 次訓練 → 每次 750 元
  await expect(page.getByRole('region', { name: '舉重腰帶' })).toContainText('平均每次訓練 NT$750（2 次）');
  await page.setViewportSize({ width: 375, height: 800 });
  await expectNoHorizontalOverflow(page, '裝備');
});
