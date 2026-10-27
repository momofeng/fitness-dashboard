// Round 3 AI 辨識記飲食：拍照／一句話 → 對應衛福部資料庫 → 依重量換算營養 → 寫入、復原、記住校正。
// 所有 Gemini 請求都被攔截並回傳假資料，絕不呼叫真實 API（會花錢，也需要金鑰）。
import { readFileSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { appDay, expectDialogButtonsInView, expectNoHorizontalOverflow, onboard, readAll } from './helpers';

const GEMINI = '**/generativelanguage.googleapis.com/**';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type,x-goog-api-key',
  'access-control-allow-methods': 'POST,OPTIONS',
};

// 營養預期值一律從隨 App 發佈的資料檔讀出，不手寫數字
type Row = unknown[];
const tfda = JSON.parse(readFileSync(new URL('../../public/data/foods-tfda.json', import.meta.url), 'utf8')) as { fields: string[]; rows: Row[] };
const col = Object.fromEntries(tfda.fields.map((f, i) => [f, i])) as Record<string, number>;
const byName = (name: string) => {
  const hit = tfda.rows.filter((r) => r[col.name!] === name);
  expect(hit, `資料檔裡「${name}」要剛好一筆`).toHaveLength(1);
  const r = hit[0]!;
  return { id: r[col.id!] as string, kcal: r[col.kcal!] as number, protein: r[col.protein!] as number, carbs: r[col.carbs!] as number, fat: r[col.fat!] as number };
};
const RICE = byName('白飯');

interface Calls {
  count: number;
  bodies: Array<Record<string, unknown>>;
  headers: Array<Record<string, string>>;
  urls: string[];
}

/** 攔截 Gemini：每次依序回傳 responses 的下一個（用完就重複最後一個） */
async function mockGemini(ctx: BrowserContext, responses: Array<unknown | { status: number; body: unknown } | 'hang'>): Promise<Calls> {
  const calls: Calls = { count: 0, bodies: [], headers: [], urls: [] };
  await ctx.route(GEMINI, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const r = responses[Math.min(calls.count, responses.length - 1)];
    calls.count += 1;
    calls.urls.push(req.url());
    calls.headers.push(req.headers());
    calls.bodies.push(JSON.parse(req.postData() ?? '{}'));
    if (r === 'hang') return; // 永不回應：測取消
    const custom = r as { status?: number; body?: unknown };
    if (custom && typeof custom === 'object' && 'status' in custom) {
      return route.fulfill({ status: custom.status!, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(custom.body) });
    }
    return route.fulfill({
      status: 200,
      headers: { ...CORS, 'content-type': 'application/json' },
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(r) }] }, finishReason: 'STOP' }] }),
    });
  });
  return calls;
}

async function makeJpeg(page: Page, w = 640, h = 480): Promise<Buffer> {
  const b64 = await page.evaluate(
    async ({ w, h }) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#c88';
      ctx.fillRect(0, 0, w, h);
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (const x of bytes) s += String.fromCharCode(x);
      return btoa(s);
    },
    { w, h },
  );
  return Buffer.from(b64, 'base64');
}

/** 透過設定頁啟用 AI 並貼上假金鑰（金鑰只存 localStorage） */
async function enableAi(page: Page) {
  await page.goto('./#/settings');
  await page.getByText('啟用 AI 辨識', { exact: true }).click();
  await expect(page.getByRole('switch', { name: /啟用 AI 辨識/ })).toBeChecked();
  await page.getByLabel('Gemini API 金鑰').fill('TEST-KEY-1234');
  await page.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(page.getByText('已儲存 ••••1234')).toBeVisible();
}

const food = (name: string, grams: number, extra: Record<string, unknown> = {}) => ({ name, altNames: [], grams, confidence: 0.9, cooked: false, ...extra });

test('拍照 → 對應白飯 → 改重量 → 加入：營養 = 資料庫每 100 g × 克數；只送出縮小的 JPEG；金鑰在 header', async ({ page, context }) => {
  const calls = await mockGemini(context, [{ foods: [food('白飯', 200)] }]);
  await page.setViewportSize({ width: 375, height: 800 });
  await onboard(page);
  await enableAi(page);

  await page.goto('./#/eat');
  await page.getByLabel('拍照記錄').setInputFiles({ name: 'meal.jpg', mimeType: 'image/jpeg', buffer: await makeJpeg(page, 2400, 1800) });

  const dlg = page.getByRole('dialog');
  await expect(dlg.getByRole('heading', { name: '辨識結果' })).toBeVisible();
  await expect(dlg.getByText('AI 認為：白飯')).toBeVisible();
  // 200 g 白飯：資料庫每 100 g 的數值 × 2
  await expect(dlg.getByText(`${Math.round(RICE.kcal * 2)} kcal`).first()).toBeVisible();
  await expectDialogButtonsInView(page, '辨識結果');
  await expectNoHorizontalOverflow(page, '辨識結果');

  // 模擬手機逐字輸入：把 200 改成 150
  const weight = dlg.getByRole('textbox', { name: /白飯的重量/ });
  await weight.click();
  await weight.press('Control+a');
  await weight.pressSequentially('150', { delay: 30 });
  await weight.blur();
  await expect(dlg.getByText(`${Math.round(RICE.kcal * 1.5)} kcal`).first()).toBeVisible();

  await dlg.getByRole('button', { name: /^加入 1 項到/ }).click();
  await expect(dlg).toHaveCount(0);

  const logs = await readAll<{ source: string; qty: number; unit: string; kcal: number; protein: number; carbs: number; fat: number; foodKey: string; date: string }>(page, 'foodLogs');
  expect(logs).toHaveLength(1);
  expect(logs[0]).toMatchObject({ source: 'ai', qty: 150, unit: 'g', foodKey: `tfda:${RICE.id}`, date: appDay() });
  expect(logs[0]!.kcal).toBeCloseTo((RICE.kcal * 150) / 100, 6);
  expect(logs[0]!.protein).toBeCloseTo((RICE.protein * 150) / 100, 6);
  expect(logs[0]!.carbs).toBeCloseTo((RICE.carbs * 150) / 100, 6);
  expect(logs[0]!.fat).toBeCloseTo((RICE.fat * 150) / 100, 6);
  await expect(page.getByText('· AI 辨識')).toBeVisible();

  // 請求內容：金鑰在 header 不在網址；照片是縮小後的 JPEG；schema 沒有營養欄位
  expect(calls.count).toBe(1);
  expect(calls.urls[0]).not.toContain('TEST-KEY');
  expect(calls.headers[0]!['x-goog-api-key']).toBe('TEST-KEY-1234');
  const parts = (calls.bodies[0] as { contents: Array<{ parts: Array<Record<string, { mime_type: string; data: string }>> }> }).contents[0]!.parts;
  const img = parts[1]!.inline_data!;
  expect(img.mime_type).toBe('image/jpeg');
  const dims = await page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${b64}`)).blob());
    return { w: bmp.width, h: bmp.height };
  }, img.data);
  expect(Math.max(dims.w, dims.h)).toBe(1024);
  expect(JSON.stringify(calls.bodies[0]!.generationConfig)).not.toMatch(/kcal|protein|carb|calor/i);
});

test('加入後可以復原；金鑰不在 IndexedDB、也不在備份檔裡', async ({ page, context }) => {
  await mockGemini(context, [{ foods: [food('白飯', 100)] }]);
  await onboard(page);
  await enableAi(page);
  await page.goto('./#/eat');
  await page.getByLabel('從相簿選照片').setInputFiles({ name: 'm.jpg', mimeType: 'image/jpeg', buffer: await makeJpeg(page) });
  await page.getByRole('dialog').getByRole('button', { name: /^加入 1 項到/ }).click();
  await expect.poll(() => readAll(page, 'foodLogs').then((r) => r.length)).toBe(1);
  await page.getByRole('button', { name: '復原' }).click();
  await expect.poll(() => readAll(page, 'foodLogs').then((r) => r.length)).toBe(0);

  // 金鑰只在 localStorage
  const dump = JSON.stringify({ settings: await readAll(page, 'settings'), matches: await readAll(page, 'aiMatches'), usage: await readAll(page, 'foodUsage') });
  expect(dump).not.toContain('TEST-KEY');
  expect(await page.evaluate(() => localStorage.getItem('fitness.ai.key'))).toBe('TEST-KEY-1234');
  await page.goto('./#/settings/data');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出備份（JSON，不含照片）' }).click();
  const backup = readFileSync((await (await download).path())!, 'utf8');
  expect(backup).not.toContain('TEST-KEY');
  expect(JSON.parse(backup).schemaVersion).toBe(4);
});

test('一句話輸入：多樣食物一次確認，取消勾選的不會寫入', async ({ page, context }) => {
  const calls = await mockGemini(context, [{ foods: [food('白飯', 120), food('高麗菜', 80, { cooked: true }), food('清蒸日本龍蝦', 150), food('嚕嚕咪咪', 300)] }]);
  await page.setViewportSize({ width: 375, height: 800 });
  await onboard(page);
  await enableAi(page);
  await page.goto('./#/eat/add?meal=dinner');
  await page.getByRole('button', { name: '一句話輸入' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('這一餐吃了什麼？').fill('半碗白飯加炒高麗菜');
  await dlg.getByRole('button', { name: '辨識', exact: true }).click();

  await expect(dlg.getByRole('heading', { name: '辨識結果' })).toBeVisible();
  // 完全對不上的食物：標示找不到、預設不勾選，也不會被硬湊一個
  const miss = dlg.getByRole('listitem', { name: '嚕嚕咪咪' });
  await expect(miss.getByText('找不到對應的食物')).toBeVisible();
  await expect(miss.getByRole('checkbox')).not.toBeChecked();
  // 只靠名稱片段猜到的（清蒸日本龍蝦 → 日本龍蝦）：列出來讓你確認，但預設不勾選
  const guessed = dlg.getByRole('listitem', { name: '清蒸日本龍蝦' });
  await expect(guessed.getByText('日本龍蝦', { exact: true })).toBeVisible();
  await expect(guessed.getByText('請確認是不是這個食物')).toBeVisible();
  await expect(guessed.getByRole('checkbox')).not.toBeChecked();
  await expect(dlg.getByRole('button', { name: /^加入 2 項到晚餐/ })).toBeVisible();
  // 煮熟的高麗菜在資料庫只有生的 → 警告
  await expect(dlg.getByText(/資料庫這筆是生食的數值/)).toBeVisible();
  await expectDialogButtonsInView(page, '一句話輸入結果');

  // 取消勾選高麗菜
  await dlg.getByRole('listitem', { name: '高麗菜' }).getByRole('checkbox').click();
  await expect(dlg.getByRole('button', { name: /^加入 1 項到晚餐/ })).toBeVisible();
  await dlg.getByRole('button', { name: /^加入 1 項到晚餐/ }).click();

  await expect(page).toHaveURL(/#\/eat$/);
  const logs = await readAll<{ name: string; meal: string; source: string }>(page, 'foodLogs');
  expect(logs).toHaveLength(1);
  expect(logs[0]).toMatchObject({ name: '白飯', meal: 'dinner', source: 'ai' });
  // 文字請求的 prompt 帶著使用者的描述
  expect(JSON.stringify(calls.bodies[0])).toContain('半碗白飯加炒高麗菜');
});

test('記住我的校正：把候選換成別的食物 → 下次同名優先對應', async ({ page, context }) => {
  await mockGemini(context, [{ foods: [food('米飯', 100)] }]);
  await page.setViewportSize({ width: 375, height: 800 });
  await onboard(page);
  await enableAi(page);
  await page.goto('./#/eat');

  const shoot = async () => {
    await page.getByLabel('拍照記錄').setInputFiles({ name: 'm.jpg', mimeType: 'image/jpeg', buffer: await makeJpeg(page) });
    return page.getByRole('dialog');
  };

  // 第一次：AI 說「米飯」，資料庫最像的不是我要的 → 搜尋換成「白飯」
  let dlg = await shoot();
  await expect(dlg.getByText('AI 認為：米飯')).toBeVisible();
  await dlg.getByRole('button', { name: '換食物' }).click();
  await dlg.getByLabel(/搜尋「米飯」的對應食物/).fill('白飯');
  await dlg.getByRole('button', { name: /^白飯/ }).first().click();
  await expect(dlg.getByText(`${Math.round(RICE.kcal)} kcal`).first()).toBeVisible();
  await dlg.getByRole('button', { name: /^加入 1 項到/ }).click();
  await expect.poll(() => readAll(page, 'aiMatches').then((r) => r.length)).toBe(1);
  expect(await readAll(page, 'aiMatches')).toEqual([expect.objectContaining({ norm: '米飯', foodKey: `tfda:${RICE.id}`, count: 1 })]);

  // 第二次（重新整理後）：「米飯」直接對應到白飯，而且不再要求確認
  await page.reload();
  dlg = await shoot();
  await expect(dlg.getByText('AI 認為：米飯')).toBeVisible();
  await expect(dlg.getByRole('listitem', { name: '米飯' }).getByText('白飯', { exact: true }).first()).toBeVisible();
  await expect(dlg.getByText('請確認是不是這個食物')).toHaveCount(0);
  await dlg.getByRole('button', { name: /^加入 1 項到/ }).click();
  await expect.poll(() => readAll<{ count: number }>(page, 'aiMatches').then((r) => r[0]?.count)).toBe(2);
});

test('沒啟用／沒金鑰 → 先引導到設定，不會先打開相機', async ({ page, context }) => {
  const calls = await mockGemini(context, [{ foods: [] }]);
  await onboard(page);
  await page.goto('./#/eat');
  await page.getByRole('button', { name: '拍照記錄' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByRole('heading', { name: '先啟用 AI 辨識' })).toBeVisible();
  await dlg.getByRole('button', { name: '前往設定' }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  expect(calls.count).toBe(0);
});

test('失敗情境：金鑰無效、額度、逾時前取消、離線 → 都有中文訊息，且可以重試', async ({ page, context }) => {
  const calls = await mockGemini(context, [
    { status: 403, body: { error: { message: 'denied' } } },
    { status: 429, body: { error: { message: 'quota' } } },
    'hang',
    { foods: [food('白飯', 100)] },
  ]);
  await onboard(page);
  await enableAi(page);
  await page.goto('./#/eat');
  const input = page.getByLabel('拍照記錄');
  const file = { name: 'm.jpg', mimeType: 'image/jpeg', buffer: await makeJpeg(page) };

  await input.setInputFiles(file);
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByRole('alert')).toContainText('金鑰無效或沒有權限');
  await dlg.getByRole('button', { name: '重試' }).click();
  await expect(dlg.getByRole('alert')).toContainText('額度用完');
  await dlg.getByRole('button', { name: '重試' }).click();
  // 第三次永不回應 → 可取消
  await expect(dlg.getByRole('status')).toContainText('AI 正在看這張照片');
  await dlg.getByRole('button', { name: '取消' }).click();
  await expect(dlg).toHaveCount(0);
  expect(calls.count).toBe(3);

  // 取消之後再拍一次：成功
  await input.setInputFiles(file);
  await expect(page.getByRole('dialog').getByRole('heading', { name: '辨識結果' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: '關閉' }).click();

  // 離線：不送出請求，直接說明
  await context.setOffline(true);
  await page.getByRole('button', { name: '拍照記錄' }).click();
  await expect(page.getByText('目前沒有網路，AI 辨識需要連線')).toBeVisible();
  expect(calls.count).toBe(4);
  await context.setOffline(false);
});

test('設定頁：測試連線、移除金鑰；金鑰欄是密碼欄', async ({ page, context }) => {
  await mockGemini(context, [{ status: 400, body: { error: { message: 'API key not valid. Please pass a valid API key.' } } }, { foods: [food('白飯', 100)] }]);
  await page.setViewportSize({ width: 375, height: 800 });
  await onboard(page);
  await page.goto('./#/settings');
  await expect(page.getByLabel('Gemini API 金鑰')).toHaveAttribute('type', 'password');
  await page.getByText('啟用 AI 辨識', { exact: true }).click();
  await expect(page.getByRole('switch', { name: /啟用 AI 辨識/ })).toBeChecked();
  await page.getByLabel('Gemini API 金鑰').fill('bad key with spaces');
  await page.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(page.getByText('金鑰格式不正確')).toBeVisible();
  await page.getByLabel('Gemini API 金鑰').fill('KEY-ABCD');
  await page.getByRole('button', { name: '儲存', exact: true }).click();

  await page.getByRole('button', { name: '測試連線' }).click();
  await expect(page.getByRole('status').filter({ hasText: '金鑰無效' })).toBeVisible();
  await page.getByRole('button', { name: '測試連線' }).click();
  await expect(page.getByRole('status').filter({ hasText: '連線成功：白飯' })).toBeVisible();
  await expectNoHorizontalOverflow(page, '設定頁 AI 區塊');

  await page.getByRole('button', { name: '移除金鑰' }).click();
  expect(await page.evaluate(() => localStorage.getItem('fitness.ai.key'))).toBeNull();
  await expect(page.getByLabel('Gemini API 金鑰')).toBeVisible();
});

test('只是成分字樣或「包含」對到的食物不預設勾選；重量超過上限標紅擋下、不自動改成上限', async ({ page, context }) => {
  await mockGemini(context, [{ foods: [food('乳清蛋白', 30), food('白飯', 100)] }]);
  await page.setViewportSize({ width: 375, height: 800 });
  await onboard(page);
  await enableAi(page);
  await page.goto('./#/eat');
  await page.getByLabel('拍照記錄').setInputFiles({ name: 'm.jpg', mimeType: 'image/jpeg', buffer: await makeJpeg(page) });
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByRole('heading', { name: '辨識結果' })).toBeVisible();

  // 「乳清蛋白」只出現在優格等食物的樣品狀態成分字樣裡 → 列出候選，但不算有把握、不預設勾選
  const whey = dlg.getByRole('listitem', { name: '乳清蛋白' });
  await expect(whey.getByRole('checkbox')).not.toBeChecked();
  await expect(whey.getByText('請確認是不是這個食物')).toBeVisible();
  // 名稱完全相同的白飯照常預設勾選
  await expect(dlg.getByRole('listitem', { name: '白飯' }).getByRole('checkbox')).toBeChecked();
  await expect(dlg.getByRole('button', { name: /^加入 1 項到/ })).toBeEnabled();

  // 重量 6000 g：失焦後仍是 6000（不被悄悄改成 5000），加入鈕停用並說明原因
  const w = dlg.getByRole('textbox', { name: /白飯的重量/ });
  await w.click();
  await w.press('Control+a');
  await w.pressSequentially('6000', { delay: 20 });
  await w.blur();
  await expect(w).toHaveValue('6000');
  await expect(dlg.getByText(/超過 5,000/)).toBeVisible();
  await expect(dlg.getByRole('button', { name: /^加入 1 項到/ })).toBeDisabled();
  await w.click();
  await w.press('Control+a');
  await w.pressSequentially('250', { delay: 20 });
  await w.blur();
  await expect(dlg.getByRole('button', { name: /^加入 1 項到/ })).toBeEnabled();
  await expectDialogButtonsInView(page, '確認清單');
});

test('「清除所有資料」連 AI 金鑰一起清掉', async ({ page }) => {
  await onboard(page);
  await enableAi(page);
  expect(await page.evaluate(() => localStorage.getItem('fitness.ai.key'))).toBe('TEST-KEY-1234');
  await page.goto('./#/settings/data');
  await page.getByRole('button', { name: '清除所有資料' }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: '確定清除' }).click(),
  ]);
  await expect(page).toHaveURL(/#\/onboarding/);
  expect(await page.evaluate(() => localStorage.getItem('fitness.ai.key'))).toBeNull();
});
