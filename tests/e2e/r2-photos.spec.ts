// Round 2 進度照與 ZIP 完整備份：上傳 → 縮圖與原圖 → 比較 → ZIP 匯出 → 清除 → 匯入 → 照片回來。
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { appDay, expectNoHorizontalOverflow, onboard, readAll } from './helpers';

/** 在瀏覽器裡畫一張 w×h 的 JPEG，回傳位元組 */
async function makeJpeg(page: Page, w: number, h: number, hue: number): Promise<Buffer> {
  const b64 = await page.evaluate(
    async ({ w, h, hue }) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, `hsl(${hue} 50% 30%)`);
      g.addColorStop(1, `hsl(${hue + 60} 50% 70%)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.92));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (const x of bytes) s += String.fromCharCode(x);
      return btoa(s);
    },
    { w, h, hue },
  );
  return Buffer.from(b64, 'base64');
}

async function addPhoto(page: Page, buf: Buffer, pose: string, date?: string) {
  await page.getByLabel('選擇進度照').setInputFiles({ name: 'p.jpg', mimeType: 'image/jpeg', buffer: buf });
  await expect(page.getByRole('heading', { name: '新增進度照' })).toBeVisible();
  await page.getByRole('dialog').getByRole('radio', { name: pose }).click();
  if (date) await page.getByLabel('拍攝日期').fill(date);
  await page.getByRole('button', { name: '儲存' }).click();
  await expect(page.getByRole('heading', { name: '新增進度照' })).toHaveCount(0);
}

test('進度照：縮到長邊 1080、縮圖 240、比較、刪除可復原；ZIP 完整備份往返', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await onboard(page);
  await page.goto('./#/photos');
  await expect(page.getByText('還沒有進度照')).toBeVisible();

  const big = await makeJpeg(page, 2000, 1500, 20);
  await page.getByLabel('選擇進度照').setInputFiles({ name: 'big.jpg', mimeType: 'image/jpeg', buffer: big });
  await expect(page.getByText(/1080×810/)).toBeVisible();
  await page.getByRole('dialog').getByRole('radio', { name: '側面' }).click();
  await page.getByLabel('備註（選填）').fill('第 1 週');
  await page.getByRole('button', { name: '儲存' }).click();
  await addPhoto(page, await makeJpeg(page, 600, 800, 200), '側面', appDay(-14));

  const photos = await readAll<{ id: string; width: number; height: number; thumb: string; pose: string }>(page, 'photos');
  expect(photos).toHaveLength(2);
  const first = photos.find((p) => p.width === 1080)!;
  expect(first).toMatchObject({ height: 810, pose: 'side' });
  expect(first.thumb).toMatch(/^data:image\/jpeg;base64,/);
  const thumbSize = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  }, first.thumb);
  expect(thumbSize).toEqual([240, 180]);
  // 小於 1080 的不放大
  expect(photos.find((p) => p.width !== 1080)).toMatchObject({ width: 600, height: 800 });
  await expect(page.getByText('還沒有做過含照片的完整備份')).toBeVisible();
  await expectNoHorizontalOverflow(page, '進度照');

  // 比較
  await page.getByRole('button', { name: '比較' }).click();
  await page.getByRole('button', { name: /側面：第 1 週/ }).click();
  await page.getByRole('button', { name: new RegExp(`側面$`) }).first().click();
  await expect(page.getByRole('heading', { name: '比較：相隔 14 天' })).toBeVisible();
  await expectNoHorizontalOverflow(page, '進度照比較');
  await page.getByRole('button', { name: '關閉' }).click();

  // 刪除 → 復原
  await page.getByRole('button', { name: /側面：第 1 週/ }).click();
  await page.getByRole('button', { name: '刪除' }).click();
  await page.getByRole('button', { name: '確定刪除' }).click();
  expect(await readAll(page, 'photoBlobs')).toHaveLength(1);
  await page.getByRole('button', { name: '復原' }).click();
  await expect(page.getByRole('button', { name: /側面：第 1 週/ })).toBeVisible();
  expect(await readAll(page, 'photoBlobs')).toHaveLength(2);

  // JSON 備份不含照片
  await page.goto('./#/settings/data');
  const dj = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出備份（JSON，不含照片）' }).click();
  const json = JSON.parse(readFileSync((await (await dj).path())!, 'utf8'));
  expect(json.includesPhotos).toBe(false);
  expect(json.tables.photos).toEqual([]);

  // ZIP 完整備份：backup.json＋每張原圖
  const dz = page.waitForEvent('download');
  await page.getByRole('button', { name: '完整備份（ZIP，含進度照）' }).click();
  const zipBuf = readFileSync((await (await dz).path())!);
  const files = unzipSync(new Uint8Array(zipBuf));
  const env = JSON.parse(new TextDecoder().decode(files['backup.json']));
  expect(env.includesPhotos).toBe(true);
  expect(env.tables.photos).toHaveLength(2);
  for (const p of env.tables.photos as Array<{ id: string; bytes: number }>) {
    const f = files[`photos/${p.id}.jpg`]!;
    expect(f.length).toBe(p.bytes);
    expect([f[0], f[1]]).toEqual([0xff, 0xd8]);
  }

  // 清除 → 從 ZIP 還原 → 照片與原圖都回來
  await page.getByRole('button', { name: '清除所有資料' }).click();
  await page.getByRole('button', { name: '確定清除' }).click();
  await expect(page).toHaveURL(/onboarding/);
  // 清除後會重新載入頁面
  await expect(page.getByRole('checkbox', { name: '我了解，開始設定' })).toBeVisible();
  expect(await readAll(page, 'photoBlobs')).toHaveLength(0);
  await page.getByLabel('選擇備份檔').setInputFiles({ name: 'full.zip', mimeType: 'application/zip', buffer: zipBuf });
  await expect(page.getByText('完整備份（含 2 張進度照）')).toBeVisible();
  await page.getByRole('button', { name: '取代並還原' }).click();
  await page.waitForURL(/#\/$/);
  // 還原後會重新載入頁面
  await page.getByRole('navigation', { name: '主要分頁' }).waitFor();
  const restored = await readAll<{ id: string }>(page, 'photos');
  expect(restored.map((p) => p.id).sort()).toEqual(photos.map((p) => p.id).sort());
  const blobs = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res) => {
      const r = indexedDB.open('momofeng-fitness-dashboard');
      r.onsuccess = () => res(r.result);
    });
    const rows = await new Promise<Array<{ id: string; blob: Blob }>>((res) => {
      const q = db.transaction('photoBlobs').objectStore('photoBlobs').getAll();
      q.onsuccess = () => res(q.result);
    });
    db.close();
    return rows.map((r) => ({ id: r.id, size: r.blob.size, type: r.blob.type }));
  });
  expect(blobs).toHaveLength(2);
  for (const b of blobs) expect(b.type).toBe('image/jpeg');
  await page.goto('./#/photos');
  await expect(page.getByRole('button', { name: /側面：第 1 週/ })).toBeVisible();
});

test('JSON 取代還原不會刪掉手機上的照片', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/photos');
  await addPhoto(page, await makeJpeg(page, 600, 800, 120), '正面');
  await page.goto('./#/settings/data');
  const dj = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出備份（JSON，不含照片）' }).click();
  const buf = readFileSync((await (await dj).path())!);
  await page.getByLabel('選擇備份檔').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: buf });
  await expect(page.getByText('這份備份不含進度照，手機上現有的照片會保留。')).toBeVisible();
  await page.getByRole('button', { name: '取代並還原' }).click();
  await expect(page.getByText('已用備份取代目前資料')).toBeVisible();
  expect(await readAll(page, 'photos')).toHaveLength(1);
  expect(await readAll(page, 'photoBlobs')).toHaveLength(1);
});
