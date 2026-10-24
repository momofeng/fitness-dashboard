// 首頁與身體頁截圖：SCREENS=1 npx playwright test screens-home
import { test, expect } from '@playwright/test';

test.skip(!process.env.SCREENS, '只在 SCREENS=1 時執行');

test('首頁截圖', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.clock.setFixedTime(new Date('2026-10-15T12:00:00+08:00'));
  await page.goto('./');
  await page.getByLabel('選擇備份檔').setInputFiles('tests/fixtures/backup-v1.json');
  await page.getByRole('button', { name: '取代並還原' }).click();
  await expect(page).not.toHaveURL(/onboarding/);
  await page.waitForURL(/#\/$/);
  await page.getByRole('navigation', { name: '主要分頁' }).waitFor();
  await page.goto('./#/eat');
  await page.getByRole('button', { name: '快速加入熱量' }).click();
  await page.getByLabel('熱量', { exact: true }).fill('900');
  await page.getByLabel('蛋白質', { exact: true }).fill('55');
  await page.getByLabel('碳水', { exact: true }).fill('100');
  await page.getByLabel('脂肪', { exact: true }).fill('25');
  await page.getByRole('button', { name: /^加入/ }).click();
  await page.goto('./#/');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'build/screens/home.png', fullPage: true });
  await page.goto('./#/body');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'build/screens/body.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('./#/');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'build/screens/home-desktop.png' });
});
