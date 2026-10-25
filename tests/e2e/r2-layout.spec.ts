// Round 2 新頁面：375px 沒有水平捲動；離線時（service worker 預先快取）每頁都能開。
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { expectDialogButtonsInView, expectNoHorizontalOverflow, onboard } from './helpers';

const ROUTES: Array<[string, string]> = [
  ['#/recovery', '恢復'],
  ['#/goals', '目標與習慣'],
  ['#/calendar', '月曆'],
  ['#/supplements', '補給品知識卡'],
  ['#/supplements/creatine', '肌酸'],
  ['#/supplements/whey-protein', '乳清蛋白'],
  ['#/products', '我的補給品與裝備'],
  ['#/photos', '進度照'],
  ['#/eat/week', '每週營養'],
  ['#/settings', '設定'],
  ['#/about', '關於與資料來源'],
  ['#/more', '更多'],
];

test('375px：Round 2 每個新頁面都沒有水平捲動', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await onboard(page);
  for (const [hash, heading] of ROUTES) {
    await page.goto(`./${hash}`);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expectNoHorizontalOverflow(page, hash);
  }
});

test('離線：Round 2 每個新頁面都能開，並能記錄恢復與打卡', async ({ page, context }) => {
  await onboard(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('navigation', { name: '主要分頁' })).toBeVisible();
  for (const [hash, heading] of ROUTES) {
    await page.goto(`./${hash}`);
    await expect(page.getByRole('heading', { level: 1, name: heading }), `離線開啟 ${hash}`).toBeVisible();
  }
  // 離線也能寫入
  await page.goto('./#/recovery');
  await page.getByLabel('睡眠時數').fill('7');
  await page.getByLabel('睡眠時數').blur();
  await page.getByRole('radio', { name: '3 普通' }).click();
  await page.goto('./#/goals');
  await page.getByRole('button', { name: '新增習慣' }).click();
  await page.getByLabel('名稱').fill('伸展');
  await page.getByRole('button', { name: '儲存' }).click();
  await page.getByRole('button', { name: '今天完成：伸展' }).click();
  await expect(page.getByRole('button', { name: '今天完成：伸展' })).toHaveAttribute('aria-pressed', 'true');
  await context.setOffline(false);
});

test('375px：確認視窗的按鈕都在畫面內（還原、清除、放棄訓練、套用範本）', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await onboard(page);
  await page.goto('./#/settings/data');
  await page.getByLabel('選擇備份檔').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: readFileSync('tests/fixtures/backup-v2.json') });
  await expect(page.getByRole('button', { name: '取代並還原' })).toBeVisible();
  await expectDialogButtonsInView(page, '還原備份');
  await page.getByRole('button', { name: '取消' }).click();
  await page.getByRole('button', { name: '清除所有資料' }).click();
  await expectDialogButtonsInView(page, '清除所有資料');
  await page.getByRole('button', { name: '取消' }).click();

  await page.goto('./#/train/program');
  await page.getByRole('button', { name: '套用這份範本' }).first().click();
  await expectDialogButtonsInView(page, '套用範本');
  await page.keyboard.press('Escape');

  await page.goto('./#/train');
  await page.getByRole('button', { name: '開始訓練' }).click();
  await page.getByRole('button', { name: '放棄這場訓練' }).click();
  await expectDialogButtonsInView(page, '放棄訓練');
});
