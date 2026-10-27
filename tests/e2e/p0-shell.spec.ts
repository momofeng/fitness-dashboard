import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, onboard, readAll } from './helpers';

test('首次設定：填資料 → 算出目標 → 套用課表 → 重新整理後不再進入設定', async ({ page }) => {
  await onboard(page);
  const settings = await readAll<{ onboarded: boolean; profile: { heightCm: number } }>(page, 'settings');
  expect(settings[0]?.onboarded).toBe(true);
  expect(settings[0]?.profile.heightCm).toBe(175);
  const body = await readAll<{ weightKg: number }>(page, 'bodyMetrics');
  expect(body[0]?.weightKg).toBe(70);
  const programs = await readAll<{ isActive: number; templateId: string }>(page, 'programs');
  expect(programs).toHaveLength(1);
  expect(programs[0]).toMatchObject({ isActive: 1, templateId: 'novice-fullbody-barbell' });

  await page.reload();
  await expect(page).not.toHaveURL(/onboarding/);
});

test('未同意免責聲明不能繼續；體重未填不能繼續', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('button', { name: '下一步' })).toBeDisabled();
  await page.getByRole('checkbox', { name: '我了解，開始設定' }).check();
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page.getByRole('button', { name: '下一步' })).toBeDisabled();
  await page.getByLabel('目前體重').fill('68.5');
  await expect(page.getByRole('button', { name: '下一步' })).toBeEnabled();
});

test('離線：首次載入後切到離線，重新整理並切換各頁仍可使用', async ({ page, context }) => {
  await onboard(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // 等 SW 接手目前頁面，確保之後的請求由 SW 回應
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('navigation', { name: '主要分頁' })).toBeVisible();
  for (const [hash, heading] of [
    ['#/train', '訓練'],
    ['#/eat', '飲食'],
    ['#/body', '身體'],
    ['#/more', '更多'],
    ['#/settings', '設定'],
    ['#/settings/data', '資料與備份'],
    ['#/about', '關於與資料來源'],
  ] as const) {
    await page.goto(`./${hash}`);
    await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
  }
  // 首頁、工具也走一遍
  await page.goto('./#/');
  await expect(page.getByRole('region', { name: '今天的飲食' })).toBeVisible();
  await page.goto('./#/tools');
  await expect(page.getByRole('heading', { level: 1, name: '小工具', exact: true })).toBeVisible();
  // 離線開始訓練並記一組
  await page.goto('./#/train');
  await page.getByRole('button', { name: '開始訓練' }).click();
  const squat = page.getByRole('region', { name: '槓鈴深蹲' });
  await squat.getByLabel('第 1 組重量').fill('40');
  await squat.getByRole('button', { name: '完成第 1 組' }).click();
  await expect(squat.getByRole('button', { name: '編輯第 1 組' })).toBeVisible();
  expect(await readAll(page, 'sets')).toHaveLength(1);
  await context.setOffline(false);
});

test('375px 寬：各頁沒有水平捲動', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await onboard(page);
  for (const hash of ['#/', '#/train', '#/eat', '#/body', '#/more', '#/settings', '#/settings/data', '#/about']) {
    await page.goto(`./${hash}`);
    await page.waitForLoadState('networkidle');
    await expectNoHorizontalOverflow(page, hash);
  }
});

test('設定頁修改會立即儲存', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/settings');
  await page.getByRole('radio', { name: '淺色' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('水平捲動檢查本身會抓到超寬元素（反向測試）', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await onboard(page);
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.style.width = '600px';
    d.style.height = '10px';
    document.querySelector('main')!.appendChild(d);
  });
  await expect(expectNoHorizontalOverflow(page, 'forced')).rejects.toThrow();
});
