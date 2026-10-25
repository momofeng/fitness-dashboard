// Round 2 獨立驗收問題的畫面層回歸測試：逐字輸入（手機鍵盤）不會存進中間值、不合法日期擋下、
// 匯出時自我驗證、目標起點回填、沒填份數不喊補貨、確認鈕在畫面內。
import { expect, test } from '@playwright/test';
import { appDay, expectDialogButtonsInView, onboard, putRows, readAll } from './helpers';

test('睡眠逐字改成 25：不會先存成 2，也不會存 25', async ({ page }) => {
  await onboard(page);
  const sleep = page.getByRole('region', { name: '今天狀態' }).getByLabel('睡眠時數');
  await sleep.fill('7.5');
  await sleep.blur();
  await sleep.click();
  await sleep.pressSequentially('25', { delay: 700 });
  await sleep.blur();
  await expect(sleep).toHaveAttribute('aria-invalid', 'true');
  const row = (await readAll<{ date: string; sleepHours: number }>(page, 'dailyLogs')).find((r) => r.date === appDay());
  expect(row?.sleepHours).toBe(7.5);
});

test('次數區間逐字修改：輸入中不會失去焦點，存成 12–15', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/train/exercise/dumbbell-curl');
  await page.getByLabel('次數下限').fill('8');
  await page.getByLabel('次數上限').fill('10');
  await page.getByLabel('次數上限').blur();
  await expect(page.getByText('已覆寫課表：8–10 下')).toBeVisible();
  const lo = page.getByLabel('次數下限');
  await lo.click();
  await lo.pressSequentially('12', { delay: 150 });
  await expect(lo).toBeFocused();
  const hi = page.getByLabel('次數上限');
  await hi.click();
  await hi.pressSequentially('15', { delay: 150 });
  await expect(hi).toBeFocused();
  await hi.blur();
  await expect(page.getByText('已覆寫課表：12–15 下')).toBeVisible();
  const pref = (await readAll<{ exerciseId: string; repMin: number; repMax: number }>(page, 'exercisePrefs')).find((p) => p.exerciseId === 'dumbbell-curl');
  expect(pref).toMatchObject({ repMin: 12, repMax: 15 });
});

test('日期欄位：0026 年擋下儲存（目標期限、身體數據）', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/goals');
  await page.getByRole('button', { name: '新增目標' }).click();
  await page.getByLabel('目標值').fill('75');
  await page.getByLabel('期限').fill('0026-12-31');
  await expect(page.getByRole('button', { name: '儲存' })).toBeDisabled();
  await expect(page.getByText('日期格式不正確')).toBeVisible();
  await page.getByLabel('期限').fill('');
  await expect(page.getByRole('button', { name: '儲存' })).toBeEnabled();
  await page.keyboard.press('Escape');

  await page.goto('./#/body');
  await page.getByRole('button', { name: '記錄圍度' }).click();
  const date = page.getByRole('dialog').locator('input[type="date"]');
  await date.fill('0026-10-01');
  await expect(page.getByRole('dialog').getByRole('button', { name: '儲存' })).toBeDisabled();
  expect((await readAll<{ date: string }>(page, 'bodyMetrics')).every((r) => r.date.startsWith('20'))).toBe(true);
});

test('匯出時自我驗證：有還原不了的資料 → 提醒是哪一筆、不更新上次備份時間', async ({ page }) => {
  await onboard(page);
  await putRows(page, 'goals', [
    {
      id: 'bad-goal', type: 'bodyweight', title: '壞日期', exerciseId: null, targetReps: null, circ: null, unit: '', startValue: 70, targetValue: 75,
      current: null, dueDate: '0026-12-31', status: 'active', doneAt: null, createdAt: 1, updatedAt: 1,
    },
  ]);
  await page.goto('./#/settings/data');
  await page.reload();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出備份（JSON，不含照片）' }).click();
  await dl;
  await expect(page.getByRole('status').filter({ hasText: '還原時會被拒絕' })).toContainText('目標第 1 筆的「期限」');
  const s = (await readAll<{ backup: { lastExportAt: number | null } }>(page, 'settings'))[0]!;
  expect(s.backup.lastExportAt).toBeNull();
});

test('目標建立時沒有體脂資料 → 之後記錄 14%（目標 15%）→ 顯示達成', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/goals');
  await page.getByRole('button', { name: '新增目標' }).click();
  await page.getByRole('radio', { name: '體脂率' }).click();
  await expect(page.getByRole('radio', { name: '減少到' })).toHaveAttribute('aria-checked', 'true');
  await page.getByLabel('目標值').fill('15');
  await page.getByRole('button', { name: '儲存' }).click();
  await expect(page.getByRole('region', { name: '體脂率 15 %' })).toContainText('到身體頁記錄體脂');
  await putRows(page, 'bodyMetrics', [{ id: `body:${appDay(-1)}`, date: appDay(-1), weightKg: 70, bodyFatPct: 14, circ: {}, note: '', updatedAt: 1 }]);
  await page.reload();
  await expect(page.getByRole('region', { name: '體脂率 15 %' })).toContainText('達成了');
});

test('補給品沒填每罐份數：不會顯示「該補貨」', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/products');
  await page.getByRole('button', { name: '新增' }).click();
  await page.getByLabel('名稱').fill('魚油');
  await page.getByLabel('類別').selectOption('omega3');
  await page.getByRole('button', { name: '儲存' }).click();
  await expect(page.getByRole('region', { name: '魚油' })).toContainText('填寫每罐份數就能估庫存');
  await expect(page.getByText('該補貨了')).toHaveCount(0);
  await page.goto('./#/');
  await expect(page.getByRole('region', { name: '今日打卡' }).getByText('該補貨')).toHaveCount(0);
});

test('375px：新增產品與目標的視窗按鈕都在畫面內', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await onboard(page);
  await page.goto('./#/products');
  await page.getByRole('button', { name: '新增' }).click();
  await expectDialogButtonsInView(page, '新增產品');
  await page.keyboard.press('Escape');
  await page.goto('./#/goals');
  await page.getByRole('button', { name: '新增目標' }).click();
  await expectDialogButtonsInView(page, '新增目標');
});

test('輸入後直接返回或按 Enter 也會存（不靠 blur）', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/');
  await page.goto('./#/recovery');
  const sleep = page.getByLabel('睡眠時數');
  await sleep.click();
  await sleep.pressSequentially('6.5', { delay: 50 });
  // 模擬 Android 返回鍵：沒有 blur 就離開頁面
  await page.goBack();
  await expect(page).toHaveURL(/#\/$/);
  await expect.poll(async () => (await readAll<{ date: string; sleepHours?: number }>(page, 'dailyLogs')).find((r) => r.date === appDay())?.sleepHours).toBe(6.5);

  const card = page.getByRole('region', { name: '今天狀態' });
  await card.getByLabel('睡眠時數').click();
  await card.getByLabel('睡眠時數').pressSequentially('7', { delay: 50 });
  await page.keyboard.press('Enter');
  await page.reload();
  await expect.poll(async () => (await readAll<{ date: string; sleepHours?: number }>(page, 'dailyLogs')).find((r) => r.date === appDay())?.sleepHours).toBe(7);
});

test('目標方向依目前紀錄判斷：72 kg 設「體重 65 kg」是減少，不會直接達成', async ({ page }) => {
  await onboard(page, { weight: '72' });
  await page.goto('./#/goals');
  await page.getByRole('button', { name: '新增目標' }).click();
  await page.getByLabel('目標值').fill('65');
  await page.getByLabel('目標值').blur();
  await expect(page.getByRole('radio', { name: '減少到' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('目前 72 kg')).toBeVisible();
  await page.getByRole('button', { name: '儲存' }).click();
  const card = page.getByRole('region', { name: '體重 65 kg' });
  await expect(card).toContainText('0%');
  await expect(card).toContainText('還差 7 kg');
  await expect(card).not.toContainText('達成');
});

test('直接開子頁網址：返回鍵往上一層走，不會在兩頁之間打轉', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/settings/data');
  await page.reload();
  await page.getByRole('link', { name: '返回' }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await page.getByRole('link', { name: '返回' }).click();
  await expect(page).toHaveURL(/#\/more$/);
});
