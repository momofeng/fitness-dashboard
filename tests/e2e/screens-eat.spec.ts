// 飲食畫面截圖：SCREENS=1 npx playwright test screens-eat
import { test } from '@playwright/test';
import { onboard } from './helpers';

test.skip(!process.env.SCREENS, '只在 SCREENS=1 時執行');

test('飲食截圖', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await onboard(page);
  await page.goto('./#/eat/add?meal=breakfast');
  await page.getByLabel('搜尋食物').fill('雞蛋');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'build/screens/eat-search.png' });
  await page.getByRole('button', { name: /^雞蛋\(白殼\)/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'build/screens/eat-amount.png' });
  await page.getByRole('button', { name: '加入早餐' }).click();
  await page.getByLabel('搜尋食物').fill('白飯');
  await page.getByRole('button', { name: /^白飯/ }).click();
  await page.getByRole('radio', { name: '午餐' }).last().click();
  await page.getByLabel('份量').fill('200');
  await page.getByRole('button', { name: '加入午餐' }).click();
  await page.goto('./#/eat');
  await page.getByRole('button', { name: '+500' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'build/screens/eat-day.png', fullPage: true });
});
