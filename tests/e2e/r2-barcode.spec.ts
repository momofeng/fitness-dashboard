// Round 2 條碼掃描：用 init script 模擬 BarcodeDetector 與相機（canvas 串流），不靠實體相機。
import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalOverflow, onboard, readAll } from './helpers';

const CODE = '4710088012340';

async function mockScanner(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __barcode: string | null; __streams: MediaStream[]; BarcodeDetector: unknown };
    w.__barcode = null;
    w.__streams = [];
    w.BarcodeDetector = class {
      static async getSupportedFormats() {
        return ['ean_13', 'ean_8', 'upc_a', 'qr_code'];
      }
      async detect() {
        return w.__barcode ? [{ rawValue: w.__barcode, format: 'ean_13' }] : [];
      }
    };
    navigator.mediaDevices.getUserMedia = async () => {
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 240;
      const ctx = c.getContext('2d')!;
      setInterval(() => {
        ctx.fillStyle = `hsl(${Date.now() % 360} 40% 40%)`;
        ctx.fillRect(0, 0, 320, 240);
      }, 100);
      const s = c.captureStream(10);
      w.__streams.push(s);
      return s;
    };
  });
}

const setCode = (page: Page, code: string | null) => page.evaluate((c) => ((window as unknown as { __barcode: string | null }).__barcode = c), code);
const liveTracks = (page: Page) =>
  page.evaluate(() => (window as unknown as { __streams: MediaStream[] }).__streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === 'live').length);

test('掃到沒建過的條碼 → 帶條碼建立自建食物 → 再掃一次直接記錄；關閉後相機停止', async ({ page }) => {
  await mockScanner(page);
  await page.setViewportSize({ width: 375, height: 800 });
  await onboard(page);
  await page.goto('./#/eat/add?meal=snack');
  await page.getByRole('button', { name: '掃條碼（找自建食物）' }).click();
  await expect(page.getByRole('status').filter({ hasText: '把條碼放進畫面中間' })).toBeVisible();
  await expectNoHorizontalOverflow(page, '條碼掃描');
  await setCode(page, CODE);

  await expect(page.getByRole('heading', { name: '找不到這個條碼' })).toBeVisible();
  await expect(page.getByText(CODE)).toBeVisible();
  expect(await liveTracks(page)).toBe(0);
  await page.getByRole('button', { name: '照營養標示建立這個食物' }).click();
  await expect(page.getByLabel('條碼', { exact: true })).toHaveValue(CODE);
  await page.getByLabel('名稱', { exact: true }).fill('無糖優格');
  await page.getByLabel('熱量', { exact: true }).fill('110');
  await page.getByLabel('蛋白質', { exact: true }).fill('10');
  await page.getByLabel('脂肪', { exact: true }).fill('4');
  await page.getByLabel('碳水化合物', { exact: true }).fill('8');
  await page.getByRole('button', { name: '儲存' }).click();
  await page.getByRole('button', { name: '加入點心' }).click();
  await expect.poll(() => readAll(page, 'foodLogs').then((r) => r.length)).toBe(1);
  const foods = await readAll<{ name: string; barcode: string }>(page, 'foodsCustom');
  expect(foods).toEqual([expect.objectContaining({ name: '無糖優格', barcode: CODE })]);

  // 第二次掃同一個條碼：直接打開份量視窗
  await page.goto('./#/eat/add?meal=snack');
  await setCode(page, null);
  await page.getByRole('button', { name: '掃條碼（找自建食物）' }).click();
  await setCode(page, CODE);
  await expect(page.getByRole('heading', { name: '無糖優格' })).toBeVisible();
  await page.getByRole('button', { name: '加入點心' }).click();
  await expect.poll(() => readAll(page, 'foodLogs').then((r) => r.length)).toBe(2);
  expect(await liveTracks(page)).toBe(0);
});

test('瀏覽器不支援 BarcodeDetector → 手動輸入條碼', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/eat/add');
  await page.getByRole('button', { name: '掃條碼（找自建食物）' }).click();
  await expect(page.getByText(/不支援條碼辨識/)).toBeVisible();
  await page.getByLabel('條碼號碼').fill('４７１００８８０１２３４１');
  await expect(page.getByText('檢查碼對不上')).toBeVisible();
  await page.getByLabel('條碼號碼').fill(CODE);
  await page.getByRole('button', { name: '確定' }).click();
  await expect(page.getByRole('heading', { name: '找不到這個條碼' })).toBeVisible();
});
