// 獨立驗收問題的畫面層回歸測試
import { expect, test } from '@playwright/test';
import { onboard, readAll } from './helpers';

test('H1：體重打錯（7.5）會標紅並擋下儲存，不會悄悄改成上下限', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/body');
  const input = page.getByLabel('今天的體重');
  await input.fill('7.5');
  await input.blur();
  await expect(input).toHaveValue('7.5');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(/請輸入 20–400 kg 之間的體重/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^(記錄|更新)$/ })).toBeDisabled();
  const rows = await readAll<{ weightKg: number }>(page, 'bodyMetrics');
  expect(rows.every((r) => r.weightKg >= 20)).toBe(true);
});

test('H1：首次設定的體脂填 0 不能繼續', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('checkbox', { name: '我了解，開始設定' }).check();
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByLabel('目前體重').fill('70');
  await page.getByLabel('體脂率').fill('0');
  await page.getByLabel('體脂率').blur();
  await expect(page.getByText(/體脂率請輸入 2–70%/)).toBeVisible();
  await expect(page.getByRole('button', { name: '下一步' })).toBeDisabled();
  await page.getByLabel('體脂率').fill('');
  await expect(page.getByRole('button', { name: '下一步' })).toBeEnabled();
});

test('H2：訓練中換動作，已記錄的組保留；移除需要確認且可復原', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/train');
  await page.getByRole('button', { name: '開始訓練' }).click();
  const squat = page.getByRole('region', { name: '槓鈴深蹲' });
  await squat.getByLabel('第 1 組重量').fill('60');
  await squat.getByRole('button', { name: '完成第 1 組' }).click();

  // 換成腿推機：深蹲的那一組還在
  await squat.getByRole('button', { name: '槓鈴深蹲 選項' }).click();
  await page.getByRole('button', { name: '換成其他動作' }).click();
  await page.getByLabel('搜尋動作').fill('腿推');
  await page.getByRole('button', { name: /^腿推機/ }).first().click();
  await expect(page.getByText('已完成的組保留在原動作')).toBeVisible();
  await expect(page.getByRole('region', { name: '腿推機' })).toBeVisible();
  const expand = squat.getByRole('button', { name: '展開槓鈴深蹲' });
  if (await expand.isVisible()) await expand.click();
  await expect(squat.getByRole('button', { name: '編輯第 1 組' })).toBeVisible();
  expect(await readAll(page, 'sets')).toHaveLength(1);

  // 移除深蹲：第一次按只提示，第二次才刪；可以復原
  await squat.getByRole('button', { name: '槓鈴深蹲 選項' }).click();
  await page.getByRole('button', { name: '從這場移除' }).click();
  await expect(page.getByText(/已經記錄了 1 組/)).toBeVisible();
  expect(await readAll(page, 'sets')).toHaveLength(1);
  await page.getByRole('button', { name: /確定移除並刪除 1 組/ }).click();
  await expect(squat).toHaveCount(0);
  expect(await readAll(page, 'sets')).toHaveLength(0);
  await page.getByRole('button', { name: '復原' }).click();
  if (await expand.isVisible()) await expand.click();
  await expect(squat.getByRole('button', { name: '編輯第 1 組' })).toBeVisible();
  expect(await readAll(page, 'sets')).toHaveLength(1);
});

test('M7：課表名稱可以清空重打', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/train/program');
  const name = page.getByLabel('課表名稱');
  await name.fill('');
  await expect(name).toHaveValue('');
  await name.fill('我的增肌課表');
  await name.blur();
  await expect(name).toHaveValue('我的增肌課表');
  const programs = await readAll<{ name: string; isActive: number }>(page, 'programs');
  expect(programs.find((p) => p.isActive === 1)?.name).toBe('我的增肌課表');
  // 清空後離開欄位 → 用預設名稱，不存空字串
  await name.fill('');
  await name.blur();
  await expect(name).toHaveValue('我的課表');
});
