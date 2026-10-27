import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { expect, test, type Page } from '@playwright/test';
import { onboard, putRows, readAll, expectNoHorizontalOverflow, expectDialogButtonsInView } from './helpers';

async function start(page: Page) {
  await onboard(page); await page.goto('./#/train'); await page.getByRole('button', { name: '開始訓練', exact: true }).click();
  return page.getByRole('region', { name: '槓鈴深蹲', exact: true });
}

test('一鍵記組、草稿接續、休息補記與錯誤輸入', async ({ page, context }) => {
  const squat = await start(page);
  await squat.getByLabel('第 1 組重量').fill('55'); await squat.getByLabel('第 1 組重量').blur();
  await expect.poll(async () => (await readAll<{ drafts?: unknown[] }>(page, 'workouts'))[0]?.drafts?.length).toBe(1);
  await page.reload(); await expect(squat.getByLabel('第 1 組重量')).toHaveValue('55');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); await context.setOffline(true);
  await squat.getByRole('button', { name: '完成第 1 組', exact: true }).evaluate((el) => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click(); });
  await expect(squat.getByRole('button', { name: '編輯第 1 組' })).toBeVisible();
  expect(await readAll(page, 'sets')).toHaveLength(1);
  await expect(page.getByRole('timer')).toBeVisible();
  await squat.getByRole('button', { name: '編輯第 1 組' }).click();
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: '第 1 組紀錄' }) });
  await dialog.getByRole('button', { name: '姿勢不穩', exact: true }).click();
  await dialog.getByLabel('這組備註').fill('最後兩下不穩');
  const weight = dialog.getByLabel('第 1 組重量'); await weight.fill(''); await weight.pressSequentially('25');
  expect((await readAll<{ weightKg: number }>(page, 'sets'))[0]?.weightKg).toBe(55);
  await weight.blur();
  await expect.poll(async () => (await readAll<{ weightKg: number }>(page, 'sets'))[0]?.weightKg).toBe(25);
  await expectDialogButtonsInView(page, '補記');
  await dialog.getByRole('button', { name: '完成編輯' }).click();
  await expect(squat.getByText('姿勢不穩、最後兩下不穩', { exact: true })).toBeVisible();
  await squat.getByLabel('第 2 組重量').fill('1001'); await squat.getByLabel('第 2 組重量').blur();
  await expect(squat.getByRole('button', { name: '完成第 2 組' })).toBeDisabled();
  await context.setOffline(false);
});

test('器械面板、快照、獨立版本與跳過', async ({ page }) => {
  if (process.env.SCREENS) await page.emulateMedia({ reducedMotion: 'reduce' });
  const squat = await start(page);
  await squat.getByRole('button', { name: '器械設定與教練提醒' }).click();
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: '器械設定', exact: true }) });
  await dialog.getByLabel('器械名稱或編號').fill('A 機');
  await dialog.getByLabel('座椅／靠墊刻度').fill('4');
  await dialog.getByLabel('面板單位').selectOption('lb');
  await dialog.getByLabel('每格重量').fill('5');
  await dialog.getByRole('button', { name: '儲存設定' }).click();
  await squat.getByLabel('第 1 組重量').fill('100'); await squat.getByRole('button', { name: '完成第 1 組' }).click();
  expect((await readAll<{ weightKg: number }>(page, 'sets'))[0]!.weightKg).toBeCloseTo(45.359, 2);
  if (process.env.SCREENS) {
    mkdirSync('build/screens', { recursive: true });
    await expect(squat.getByLabel('第 2 組重量')).toBeInViewport();
    await page.screenshot({ path: 'build/screens/train-fast-log.png', animations: 'disabled' });
  }
  await squat.getByRole('button', { name: '槓鈴深蹲 選項' }).click();
  await page.getByRole('button', { name: '時間不足', exact: true }).click();
  await expect(squat).toContainText('已跳過剩餘組：時間不足');
  await squat.getByRole('button', { name: '槓鈴深蹲 選項' }).click();
  await page.getByLabel('器械版本名稱').fill('B 機');
  await page.getByRole('button', { name: '建立版本並換用' }).click();
  await expect(page.getByRole('region', { name: '槓鈴深蹲 · B 機', exact: true })).toBeVisible();
  const w = (await readAll<{ plan: Array<{ id: string; context?: { machine: string } }> }>(page, 'workouts'))[0]!;
  expect(w.plan[0]?.context?.machine).toBe('A 機');
  expect(new Set(w.plan.map((p) => p.id)).size).toBe(w.plan.length);
});

test('當日多場、有氧、完整圖片、隱藏內容與取消分享', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', { value: async () => { (window as unknown as { shared: number }).shared = 1; throw new DOMException('cancel', 'AbortError'); }, configurable: true });
  });
  await onboard(page);
  const date = '2026-10-26'; const t = Date.UTC(2026, 9, 26, 2);
  const plan = { id: 'p', exerciseId: 'leg-press', nameSnapshot: '腿推機 A', sets: 3, repMin: 8, repMax: 12, targetWeightKg: 50, targetReps: 12, incrementKg: 5, restSec: 90, progression: 'double', context: { machine: 'A', seat: '4', weightMeaning: 'machine', unit: 'kg' } };
  const w = { id: 'w1', date, status: 'done', programId: null, dayId: null, dayName: '自主訓練', plan: [plan], startedAt: t, endedAt: t + 3600000, restEndsAt: null, notes: '請教練確認握距', summary: null, updatedAt: t };
  await putRows(page, 'workouts', [w, { ...w, id: 'w2', dayName: '教練課', plan: [], startedAt: t + 7200000 }]);
  await putRows(page, 'sets', [50, 50, 45].map((kg, i) => ({ id: 's' + i, workoutId: 'w1', date, exerciseId: 'leg-press', planItemId: 'p', order: i, position: i, kind: 'working', weightKg: kg, reps: 12 - i, rir: null, flags: i === 2 ? ['form'] : [], note: i === 2 ? '姿勢提醒'.repeat(110) : '', completedAt: t + i, updatedAt: t + i })));
  await putRows(page, 'cardio', [{ id: 'c', date, type: '快走', minutes: 20, distanceKm: null, kcal: null, note: '', inclinePct: 5, updatedAt: t }]);
  await page.goto('./#/train/history/w1'); await page.reload();
  await page.getByRole('button', { name: '分享當日紀錄' }).click();
  const text = page.getByLabel('當日分享文字');
  await expect(text).toContainText('50 kg × 12／11；45 kg × 10');
  await expect(text).toContainText('教練課'); await expect(text).toContainText('坡度 5%');
  await expect(text).toContainText('待教練確認');
  await expect(page.getByRole('button', { name: /分享圖片（/ })).toBeEnabled();
  await page.getByText(/預覽分享圖片/).click();
  expect(await page.getByRole('img', { name: /分享圖片第/ }).count()).toBeGreaterThan(1);
  let downloads = 0; page.on('download', () => downloads++);
  await page.getByRole('button', { name: /分享圖片（/ }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { shared: number }).shared)).toBe(1);
  expect(downloads).toBe(0);
  await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true }));
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: /分享圖片（/ }).click();
  const zip = unzipSync(new Uint8Array(readFileSync((await (await downloaded).path())!)));
  expect(Object.keys(zip).length).toBeGreaterThan(1);
  for (const bytes of Object.values(zip)) expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  if (process.env.SCREENS) {
    mkdirSync('build/screens', { recursive: true });
    writeFileSync('build/screens/share-coach-page1.png', Object.values(zip)[0]!);
    await page.screenshot({ path: 'build/screens/share-preview.png', animations: 'disabled' });
  }
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied'); } }, configurable: true }));
  await page.getByRole('button', { name: '複製文字', exact: true }).click();
  await expect.poll(() => text.evaluate((el: HTMLTextAreaElement) => el.selectionEnd - el.selectionStart)).toBe((await text.inputValue()).length);
  await page.getByRole('checkbox', { name: '狀態與逐組備註' }).uncheck();
  await expect(text).not.toContainText('姿勢提醒'); await expect(text).not.toContainText('待教練確認');
  if (process.env.SCREENS) {
    await page.getByRole('button', { name: '關閉', exact: true }).click();
    const records = await readAll(page, 'sets');
    await putRows(page, 'sets', records.map((r) => ({ ...r, note: r.id === 's2' ? '最後兩下聳肩，請教練確認' : '' })));
    await page.reload(); await page.getByRole('button', { name: '分享當日紀錄' }).click();
    await page.getByText('選擇要分享的動作與場次').click();
    await page.getByRole('checkbox', { name: '教練課', exact: true }).uncheck();
    await expect(page.getByRole('button', { name: /分享圖片（/ })).toBeEnabled();
    await page.getByText(/預覽分享圖片/).click();
    const image = page.getByRole('img', { name: '分享圖片第 1 張', exact: true });
    const bytes = await image.evaluate(async (img: HTMLImageElement) => Array.from(new Uint8Array(await (await fetch(img.src)).arrayBuffer())));
    writeFileSync('build/screens/coach-summary-example.png', new Uint8Array(bytes));
  }

});

test('360–412px、儲存失敗可重試及有氧快捷', async ({ page }) => {
  const squat = await start(page);
  for (const width of [360, 375, 412]) {
    await page.setViewportSize({ width, height: 812 }); await expectNoHorizontalOverflow(page, '逐組紀錄 ' + width);
    const bounds = await squat.getByRole('button', { name: '完成第 1 組' }).boundingBox(); expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  await squat.getByLabel('第 1 組重量').fill('60');
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    let failed = false;
    IDBObjectStore.prototype.put = function(...args) { if (this.name === 'sets' && !failed) { failed = true; throw new DOMException('test failure', 'QuotaExceededError'); } return original.apply(this, args); };
  });
  await squat.getByRole('button', { name: '完成第 1 組' }).click();
  await expect(page.getByText(/記錄失敗，請重試/)).toBeVisible();
  await expect(squat.getByLabel('第 1 組重量')).toHaveValue('60');
  await squat.getByRole('button', { name: '完成第 1 組' }).click();
  await expect(squat.getByRole('button', { name: '編輯第 1 組' })).toBeVisible();
  await page.goto('./#/train/cardio');
  await page.getByRole('button', { name: '20 分', exact: true }).click();
  await page.getByText('距離、器械設定與感受（選填）').click();
  await page.getByLabel('速度').fill('6'); await page.getByLabel('坡度').fill('4');
  await page.getByRole('button', { name: '記錄', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('分鐘')).toHaveValue('20');
  expect((await readAll<{ speedKmh: number; inclinePct: number }>(page, 'cardio'))[0]).toMatchObject({ speedKmh: 6, inclinePct: 4 });
});
