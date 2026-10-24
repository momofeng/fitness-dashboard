// 截圖給人工檢視：SCREENS=1 npx playwright test screens
import { test } from '@playwright/test';
import { onboard } from './helpers';

test.skip(!process.env.SCREENS, '只在 SCREENS=1 時執行');

const ROUTES = (process.env.SCREENS_ROUTES ?? '#/,#/settings,#/settings/data,#/more').split(',');

test('截圖', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('./');
  await page.screenshot({ path: 'build/screens/onboarding-0.png' });
  await page.getByRole('checkbox', { name: '我了解，開始設定' }).check();
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByLabel('目前體重').fill('70');
  await page.screenshot({ path: 'build/screens/onboarding-1.png' });
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('button', { name: '下一步' }).click();
  await page.screenshot({ path: 'build/screens/onboarding-3.png' });
  await page.getByRole('button', { name: '下一步' }).click();
  await page.screenshot({ path: 'build/screens/onboarding-4.png', fullPage: true });
  await page.getByRole('button', { name: '完成，開始使用' }).click();
  for (const r of ROUTES) {
    await page.goto(`./${r}`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `build/screens/${r.replace(/[#/]+/g, '_') || 'home'}.png`, fullPage: true });
  }
});
