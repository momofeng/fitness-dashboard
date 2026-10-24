// 訓練畫面截圖：SCREENS=1 npx playwright test screens-train
import { test, expect } from '@playwright/test';
import { onboard } from './helpers';

test.skip(!process.env.SCREENS, '只在 SCREENS=1 時執行');

test('訓練截圖', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await onboard(page);
  await page.goto('./#/train');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'build/screens/train-home.png', fullPage: true });
  await page.getByRole('button', { name: '開始訓練' }).click();
  const squat = page.getByRole('region', { name: '槓鈴深蹲' });
  await squat.getByLabel('第 1 組重量').fill('60');
  await squat.getByRole('button', { name: '完成第 1 組' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.screenshot({ path: 'build/screens/train-session.png' });
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.getByRole('button', { name: '完成並計算下次重量' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'build/screens/train-result.png' });
  await page.goto('./#/train');
  await page.getByRole('radio', { name: '全身 A' }).click();
  await page.getByRole('button', { name: '開始訓練' }).click();
  await page.screenshot({ path: 'build/screens/train-session-2.png' });
});
