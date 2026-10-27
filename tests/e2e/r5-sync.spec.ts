import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { onboard, readAll, expectNoHorizontalOverflow, expectDialogButtonsInView } from './helpers';
const ENDPOINT = process.env.SYNC_TEST_ENDPOINT ?? 'http://127.0.0.1:8789/api';
test.setTimeout(60_000);
async function endpoint(page: Page) {
  await page.goto('./#/sync');
  await page.getByText('進階：同步服務位址').click();
  await page.getByLabel('同步服務位址').fill(ENDPOINT);
}
async function create(page: Page) {
  await onboard(page); await endpoint(page);
  await page.getByRole('button', { name: '建立同步空間', exact: true }).click();
  const key = page.getByLabel('我的恢復金鑰'); await expect(key).toHaveValue(/^FIT1\./);
  const recovery = await key.inputValue();
  await page.getByRole('checkbox', { name: '我已另外妥善保存恢復金鑰' }).check();
  await page.getByRole('button', { name: '我已保存，完成' }).click();
  return recovery;
}
async function join(page: Page, key: string) {
  await endpoint(page); await page.getByRole('button', { name: '輸入恢復金鑰或配對碼', exact: true }).click();
  await page.getByLabel('恢復金鑰或限時配對碼').fill(key);
  await page.getByRole('button', { name: '讀取並預覽紀錄' }).click();
  await expect(page.getByRole('heading', { name: '確認加入同步空間' })).toBeVisible();
  await page.getByRole('button', { name: '保留兩邊紀錄並啟用同步' }).click();
  await expect(page.getByRole('button', { name: '立即同步', exact: true })).toBeVisible();
  await expect.poll(async () => (await readAll<{ onboarded: boolean }>(page, 'settings'))[0]?.onboarded).toBe(true);
}
async function fresh(context: BrowserContext) { const page = await context.newPage(); return page; }
async function now(page: Page) {
  await page.goto('./#/sync');
  await page.getByRole('button', { name: '立即同步', exact: true }).click();
  await expect(page.getByText('已同步', { exact: true })).toBeVisible();
}
async function cardio(page: Page, minutes: number) {
  await page.goto('./#/train/cardio');
  await page.getByLabel('分鐘', { exact: true }).fill(String(minutes));
  await page.getByRole('button', { name: '記錄', exact: true }).click();
  await expect(page.getByText('已記錄有氧', { exact: true })).toBeVisible();
}
async function editCardio(page: Page, minutes: number) {
  await page.goto('./#/train/cardio');
  await page.getByRole('button', { name: '修改', exact: true }).first().click();
  await page.getByLabel('分鐘', { exact: true }).fill(String(minutes));
  await page.getByRole('button', { name: '更新紀錄', exact: true }).click();
  await expect(page.getByText('已更新有氧紀錄', { exact: true })).toBeVisible();
}
test('免帳號金鑰加入、兩裝置同步與錯誤金鑰不改資料', async ({ page, browser }) => {
  const recovery = await create(page);
  await cardio(page, 20); await now(page);
  const other = await browser.newContext({ locale: 'zh-TW', timezoneId: 'Asia/Taipei' }); const second = await fresh(other);
  try {
    await join(second, recovery);
    expect(await readAll(second, 'cardio')).toHaveLength(1);
    await cardio(second, 30); await now(second); await now(page);
    expect(await readAll(page, 'cardio')).toHaveLength(2);
    await page.goto('./#/settings/data');
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: '匯出備份（JSON，不含照片）' }).click();
    const { readFileSync } = await import('node:fs');
    expect(readFileSync((await (await download).path())!, 'utf8')).not.toContain(recovery);
    const blank = await browser.newContext(); const invalid = await fresh(blank);
    await endpoint(invalid); await invalid.getByRole('button', { name: '輸入恢復金鑰或配對碼', exact: true }).click();
    await invalid.getByLabel('恢復金鑰或限時配對碼').fill('123456');
    await invalid.getByRole('button', { name: '讀取並預覽紀錄' }).click();
    await expect(invalid.getByRole('dialog').getByText(/請輸入完整/)).toBeVisible();
    expect(await readAll(invalid, 'cardio')).toHaveLength(0); await blank.close();
  } finally { await other.close(); }
});

test('離線同筆修改會保留衝突，使用者選擇後兩台一致', async ({ page, browser, context }) => {
  const recovery = await create(page); await cardio(page, 20); await now(page);
  const other = await browser.newContext({ locale: 'zh-TW', timezoneId: 'Asia/Taipei' }); const second = await fresh(other);
  try {
    await join(second, recovery);
    for (const device of [page, second]) {
      await device.evaluate(async () => { await navigator.serviceWorker.ready; });
      await device.reload();
      await expect.poll(() => device.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    }
    await context.setOffline(true); await other.setOffline(true);
    for (const device of [page, second]) {
      await expect(device.getByText(/^最後成功：/)).not.toContainText('尚未完成');
    }
    await editCardio(page, 25); await editCardio(second, 30);
    await context.setOffline(false); await now(page);
    await other.setOffline(false); await second.goto('./#/sync');
    await second.getByRole('button', { name: '立即同步', exact: true }).click();
    await expect(second.getByRole('heading', { name: /需要確認/ })).toBeVisible();
    expect((await readAll<{ minutes: number }>(second, 'cardio'))[0]?.minutes).toBe(30);
    await second.getByRole('radio', { name: '保留此裝置' }).check();
    await second.getByRole('button', { name: '立即同步', exact: true }).click();
    await expect(second.getByRole('heading', { name: /需要確認/ })).toBeVisible();
    await expect(second.getByRole('radio', { name: '保留此裝置' })).toBeChecked();
    if (process.env.SCREENS) await second.screenshot({ path: 'build/screens/sync-conflict.png', fullPage: true });
    await second.getByRole('button', { name: '確認選擇並同步' }).click();
    await expect(second.getByText('已同步', { exact: true })).toBeVisible();
    await now(page);
    expect((await readAll<{ minutes: number }>(page, 'cardio'))[0]?.minutes).toBe(30);
    if (process.env.SCREENS) await second.screenshot({ path: 'build/screens/sync-ready.png', fullPage: true });
  } finally { await context.setOffline(false).catch(() => undefined); await other.close(); }
});

test('限時配對只能領取一次，頁面在360px可操作', async ({ page, browser }) => {
  await create(page);
  await page.getByRole('button', { name: '產生限時配對 QR 碼' }).click();
  const code = await page.getByLabel('限時配對碼', { exact: true }).inputValue();
  await expect(page.getByRole('img', { name: '限時配對 QR 碼' })).toBeVisible();
  await page.setViewportSize({ width: 360, height: 812 });
  await expectDialogButtonsInView(page, '同步配對');
  const other = await browser.newContext({ locale: 'zh-TW', timezoneId: 'Asia/Taipei' }); const second = await fresh(other);
  try {
    await join(second, code);
    const blank = await browser.newContext(); const third = await fresh(blank);
    await endpoint(third); await third.getByRole('button', { name: '輸入恢復金鑰或配對碼', exact: true }).click();
    await third.getByLabel('恢復金鑰或限時配對碼').fill(code);
    await third.getByRole('button', { name: '讀取並預覽紀錄' }).click();
    await expect(third.getByRole('dialog').getByText(/配對碼已到期、已使用/)).toBeVisible(); await blank.close();
    await page.getByRole('button', { name: '關閉', exact: true }).click();
    await expectNoHorizontalOverflow(page, '加密同步360px');
    if (process.env.SCREENS) await page.screenshot({ path: 'build/screens/sync-key.png', fullPage: true });
  } finally { await other.close(); }
});

test('進行中的訓練不被同步覆蓋，完成後才傳到另一裝置', async ({ page, browser }) => {
  const recovery = await create(page);
  const other = await browser.newContext({ locale: 'zh-TW', timezoneId: 'Asia/Taipei' }); const second = await fresh(other);
  try {
    await join(second, recovery);
    await page.goto('./#/train'); await page.getByRole('button', { name: '開始訓練', exact: true }).click();
    const squat = page.getByRole('region', { name: '槓鈴深蹲', exact: true });
    await squat.getByLabel('第 1 組重量').fill('60'); await squat.getByRole('button', { name: '完成第 1 組' }).click();
    await cardio(second, 20); await now(second); await now(page);
    expect((await readAll<{ status: string }>(page, 'workouts')).filter((w) => w.status === 'active')).toHaveLength(1);
    expect(await readAll(page, 'sets')).toHaveLength(1); expect(await readAll(second, 'workouts')).toHaveLength(0);
    await page.goto('./#/train'); await page.getByRole('button', { name: '繼續訓練' }).click();
    await page.getByRole('button', { name: '完成', exact: true }).click(); await page.getByRole('button', { name: '完成並計算下次重量' }).click();
    await expect(page.getByText('下次怎麼練')).toBeVisible(); await now(page); await now(second);
    expect((await readAll<{ status: string }>(second, 'workouts'))[0]?.status).toBe('done'); expect(await readAll(second, 'sets')).toHaveLength(1);
  } finally { await other.close(); }
});

async function clearFromOtherTab(page: Page) {
  await page.goto('./#/settings/data');
  await page.getByRole('button', { name: '清除所有資料', exact: true }).click();
  await page.getByRole('button', { name: '確定清除', exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('fd:sync:epoch'))).not.toBeNull();
}

test('還原近期雲端版本會建立新版本，停止同步保留本機紀錄', async ({ page, browser }) => {
  const recovery = await create(page); await cardio(page, 20); await now(page);
  await cardio(page, 30); await now(page);
  await page.getByRole('button', { name: '查看近期同步版本' }).click();
  const row = page.getByText('版本 2', { exact: false }).locator('..');
  await row.getByRole('button', { name: '還原', exact: true }).click();
  await page.getByRole('button', { name: '還原此版本並同步到其他裝置' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await readAll(page, 'cardio')).toHaveLength(1);
  const other = await browser.newContext(); const second = await fresh(other);
  try { await join(second, recovery); expect(await readAll(second, 'cardio')).toHaveLength(1); } finally { await other.close(); }
  await page.getByRole('button', { name: '停止此裝置同步', exact: true }).click();
  await page.getByRole('button', { name: '停止同步並移除此裝置金鑰', exact: true }).click();
  await expect(page.getByRole('button', { name: '建立同步空間', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('fd:sync:credential'))).toBeNull();
  expect(await readAll(page, 'cardio')).toHaveLength(1);
});

test('建立同步空間途中清除資料，不會重新寫回金鑰或本機資料', async ({ page, context }) => {
  await onboard(page); await cardio(page, 20); await endpoint(page);
  let release!: () => void; const held = new Promise<void>((r) => { release = r; });
  let arrived!: () => void; const requested = new Promise<void>((r) => { arrived = r; });
  await page.route(ENDPOINT + '/v1/vaults/*', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = await route.fetch(); arrived(); await held; await route.fulfill({ response });
  });
  await page.getByRole('button', { name: '建立同步空間', exact: true }).click(); await requested;
  const tab = await context.newPage();
  try {
    await clearFromOtherTab(tab); release(); await expect(tab).toHaveURL(/onboarding/);
    await page.reload();
    expect(await page.evaluate(() => localStorage.getItem('fd:sync:credential'))).toBeNull();
    expect(await readAll(page, 'cardio')).toHaveLength(0);
  } finally { release(); await tab.close(); }
});

test('還原等待網路時由另一分頁清除資料，回應抵達後不復活', async ({ page, context }) => {
  await create(page); await cardio(page, 20); await now(page);
  await page.getByRole('button', { name: '查看近期同步版本' }).click();
  let release!: () => void; const held = new Promise<void>((r) => { release = r; });
  let arrived!: () => void; const requested = new Promise<void>((r) => { arrived = r; });
  await page.route(ENDPOINT + '/v1/vaults/*', async (route) => {
    if (route.request().method() !== 'GET' || !route.request().url().includes('?revision=1')) return route.continue();
    const response = await route.fetch(); arrived(); await held; await route.fulfill({ response });
  });
  await page.getByRole('button', { name: '還原', exact: true }).last().click();
  await page.getByRole('button', { name: '還原此版本並同步到其他裝置' }).click(); await requested;
  const tab = await context.newPage();
  try {
    await clearFromOtherTab(tab); release(); await expect(tab).toHaveURL(/onboarding/);
    await page.reload();
    expect(await page.evaluate(() => localStorage.getItem('fd:sync:credential'))).toBeNull();
    expect(await readAll(page, 'cardio')).toHaveLength(0);
  } finally { release(); await tab.close(); }
});
