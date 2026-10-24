import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalOverflow, onboard, readAll } from './helpers';

const FIXTURE = 'tests/fixtures/backup-v1.json';

async function importFile(page: Page, file: string | { name: string; mimeType: string; buffer: Buffer }) {
  await page.getByLabel('選擇備份檔').setInputFiles(file);
}

test('匯入 14 天體重 fixture → 7 日均線與週增重率正確', async ({ page }) => {
  // fixture 是 2026-10-01～10-15 的體重；把「今天」固定在 10-15
  await page.clock.setFixedTime(new Date('2026-10-15T12:00:00+08:00'));
  await onboard(page);
  await page.goto('./#/settings/data');
  await importFile(page, FIXTURE);
  await expect(page.getByText('確認還原')).toBeVisible();
  await page.getByRole('button', { name: '取代並還原' }).click();
  await expect(page.getByText('已用備份取代目前資料')).toBeVisible();

  await page.goto('./#/body');
  // 10-09～10-15：70.40…70.70 → 平均 70.55；前一週（缺 10-06）平均 70.1917 → +0.51%
  await expect(page.getByText('70.55')).toBeVisible();
  await expect(page.getByText('+0.51')).toBeVisible();
  await expect(page.getByText(/偏快|剛好|偏慢/).first()).toBeVisible();
  await expect(page.getByText('每日體重')).toBeVisible(); // 圖例
});

test('從首次設定頁直接還原備份（換新手機）', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveURL(/onboarding/);
  await importFile(page, FIXTURE);
  await page.getByRole('button', { name: '取代並還原' }).click();
  await expect(page).not.toHaveURL(/onboarding/);
  expect((await readAll(page, 'bodyMetrics')).length).toBe(14);
});

test('匯出 → 清除 → 還原 → 再匯出，兩份一致；壞檔不改變資料', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/eat');
  await page.getByRole('button', { name: '+500' }).click();
  await page.getByRole('button', { name: '快速加入熱量' }).click();
  await page.getByLabel('熱量', { exact: true }).fill('640');
  await page.getByRole('button', { name: /^加入/ }).click();
  await page.goto('./#/body');
  await page.getByLabel('今天的體重').fill('70.4');
  await page.getByRole('button', { name: /^(記錄|更新)$/ }).click();
  await expect(page.getByText('已記錄體重')).toBeVisible();

  await page.goto('./#/settings/data');
  const d1 = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出備份（JSON）' }).click();
  const first = JSON.parse(readFileSync((await (await d1).path())!, 'utf8'));
  expect(first.tables.foodLogs).toHaveLength(1);

  // 壞檔：資料不變
  const before = await readAll(page, 'foodLogs');
  await importFile(page, {
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"app":"fitness-dashboard","schemaVersion":1,"tables":{"foodLogs":[{"id":1}]}}'),
  });
  await expect(page.getByText('無法匯入')).toBeVisible();
  await expect(page.getByText(/整批拒絕/)).toBeVisible();
  await page.getByRole('button', { name: '關閉' }).click();
  expect(await readAll(page, 'foodLogs')).toEqual(before);

  // 清除所有資料 → 回到首次設定 → 還原
  await page.getByRole('button', { name: '清除所有資料' }).click();
  await page.getByRole('button', { name: '確定清除' }).click();
  await expect(page).toHaveURL(/onboarding/);
  expect(await readAll(page, 'foodLogs')).toHaveLength(0);
  await importFile(page, { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(first)) });
  await page.getByRole('button', { name: '取代並還原' }).click();
  await expect(page).not.toHaveURL(/onboarding/);

  await page.goto('./#/settings/data');
  const d2 = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出備份（JSON）' }).click();
  const second = JSON.parse(readFileSync((await (await d2).path())!, 'utf8'));
  // 去掉會變的欄位：匯出時間、上次備份時間、設定的 updatedAt
  const strip = (b: { exportedAt?: number; tables: { settings: Array<{ backup: { lastExportAt: unknown }; updatedAt: unknown }> } }) => {
    const { exportedAt: _e, ...rest } = b;
    const s = rest.tables.settings[0]!;
    s.backup.lastExportAt = null;
    s.updatedAt = 0;
    return rest;
  };
  expect(strip(second)).toEqual(strip(first));
});

test('首頁總覽：數字與飲食頁一致；備份提醒', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/eat');
  await page.getByRole('button', { name: '快速加入熱量' }).click();
  await page.getByLabel('熱量', { exact: true }).fill('700');
  await page.getByLabel('蛋白質', { exact: true }).fill('40');
  await page.getByRole('button', { name: /^加入/ }).click();
  await expect(page.getByText(/已吃\s*700/)).toBeVisible();
  const eatHero = await page.getByText('今天還可以吃').locator('..').locator('p.num').innerText();

  await page.goto('./#/');
  const dash = page.getByRole('region', { name: '今天的飲食' });
  const dashHero = await dash.getByText('今天還可以吃').locator('..').locator('p.num').innerText();
  expect(dashHero).toBe(eatHero);
  await expect(dash.getByText(/已吃\s*700/)).toBeVisible();
  await expect(page.getByRole('region', { name: '今天的訓練' }).getByText('全身 A')).toBeVisible();

  // 有資料又沒備份過 → 顯示提醒；備份後消失
  await expect(page.getByText(/還沒有備份過/)).toBeVisible();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: '備份', exact: true }).click();
  await dl;
  await expect(page.getByText(/還沒有備份過/)).toHaveCount(0);
});

test('小工具：1RM、暖身組', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/tools');
  await page.getByLabel('重量', { exact: true }).fill('100');
  await page.getByLabel('次數', { exact: true }).fill('5');
  await expect(page.getByText('116.7 kg')).toBeVisible();
  await expect(page.getByText('112.5 kg')).toBeVisible();
  await page.getByRole('tab', { name: '暖身組' }).click();
  await page.getByLabel('正式組重量').fill('100');
  await expect(page.getByText('80 kg × 2')).toBeVisible();
});

test('身體、首頁、工具在 375px 沒有水平捲動', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.clock.setFixedTime(new Date('2026-10-15T12:00:00+08:00'));
  await page.goto('./');
  await importFile(page, FIXTURE);
  await page.getByRole('button', { name: '取代並還原' }).click();
  await expect(page).not.toHaveURL(/onboarding/);
  for (const hash of ['#/', '#/body', '#/tools']) {
    await page.goto(`./${hash}`);
    await page.waitForLoadState('networkidle');
    await expectNoHorizontalOverflow(page, hash);
  }
});
