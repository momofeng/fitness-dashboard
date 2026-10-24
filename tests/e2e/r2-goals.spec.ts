// Round 2 目標與習慣、月曆熱圖。
import { expect, test } from '@playwright/test';
import { appDay, doneWorkout, expectNoHorizontalOverflow, onboard, putRows, readAll } from './helpers';

test('目標：體重與動作目標，進度依紀錄自動更新', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await onboard(page);
  const seed = doneWorkout('seed-w1', appDay(-2), 'barbell-back-squat', 90, [5, 5, 3], Date.now() - 3 * 86400_000);
  await putRows(page, 'workouts', [seed.workout]);
  await putRows(page, 'sets', seed.sets);
  await page.goto('./#/goals');
  await page.reload();

  // 體重 70 → 75
  await page.getByRole('button', { name: '新增目標' }).click();
  await page.getByLabel('目標值').fill('7.5');
  await page.getByLabel('目標值').blur();
  await expect(page.getByRole('button', { name: '儲存' })).toBeDisabled();
  await page.getByLabel('目標值').fill('75');
  await page.getByRole('button', { name: '儲存' }).click();
  const bw = page.getByRole('region', { name: '體重 75 kg' });
  await expect(bw).toContainText('70');
  await expect(bw).toContainText('0%');

  // 深蹲 100 kg × 5（目前做過 90 × 5）
  await page.getByRole('button', { name: '新增目標' }).click();
  await page.getByRole('radio', { name: '動作重量' }).click();
  await page.getByRole('button', { name: '選擇動作' }).click();
  await page.getByLabel('搜尋動作').fill('深蹲');
  await page.getByRole('button', { name: /^槓鈴深蹲/ }).first().click();
  await page.getByLabel('目標值').fill('100');
  await page.getByRole('button', { name: '儲存' }).click();
  const lift = page.getByRole('region', { name: '槓鈴深蹲 100 kg × 5 下' });
  await expect(lift).toContainText('90');
  await expect(lift).toContainText('還差 10 kg');
  await expectNoHorizontalOverflow(page, '目標與習慣');

  // 今天的體重改成 72.5（同一天只有一筆）→ 進度 50%
  await page.goto('./#/body');
  await page.getByLabel('今天的體重').fill('72.5');
  await page.getByRole('button', { name: /^(記錄|更新)$/ }).click();
  await page.goto('./#/goals');
  await expect(page.getByRole('region', { name: '體重 75 kg' })).toContainText('50%');
  const goals = await readAll<{ type: string; startValue: number; targetValue: number }>(page, 'goals');
  expect(goals.find((g) => g.type === 'lift')).toMatchObject({ startValue: 90, targetValue: 100 });
});

test('習慣：手動打卡＋自動判定，首頁今日打卡同步', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/goals');
  await page.getByRole('button', { name: '新增習慣' }).click();
  await page.getByLabel('名稱').fill('睡前伸展');
  await page.getByRole('button', { name: '儲存' }).click();
  await page.getByRole('button', { name: '新增習慣' }).click();
  await page.getByRole('button', { name: '每天量體重' }).click();
  await page.getByRole('button', { name: '儲存' }).click();

  await page.getByRole('button', { name: '今天完成：睡前伸展' }).click();
  await expect(page.getByRole('button', { name: '今天完成：睡前伸展' })).toHaveAttribute('aria-pressed', 'true');
  // 首次設定時記過體重 → 自動完成
  await expect(page.getByRole('img', { name: '今天已達成' })).toBeVisible();
  const logs = await readAll<{ id: string; date: string }>(page, 'habitLogs');
  expect(logs).toHaveLength(1);
  expect(logs[0]!.date).toBe(appDay());

  await page.goto('./#/');
  const card = page.getByRole('region', { name: '今日打卡' });
  await expect(card).toContainText('2/2');
  await card.getByRole('button', { name: '睡前伸展' }).click();
  await expect(card).toContainText('1/2');
  expect(await readAll(page, 'habitLogs')).toHaveLength(0);
});

test('月曆熱圖：訓練組數、睡眠；點日期看明細', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await onboard(page);
  const seed = doneWorkout('seed-w1', appDay(), 'barbell-back-squat', 60, [5, 5, 5], Date.now() - 3600_000);
  await putRows(page, 'workouts', [seed.workout]);
  await putRows(page, 'sets', seed.sets);
  await putRows(page, 'dailyLogs', [{ date: appDay(), waterMl: 0, sleepHours: 8, updatedAt: 1 }]);
  await page.goto('./#/calendar');
  await page.reload();
  const todayCell = page.getByRole('gridcell', { name: /3 組正式組/ });
  await expect(todayCell).toBeVisible();
  await expectNoHorizontalOverflow(page, '月曆');
  await page.getByRole('radio', { name: '睡眠' }).click();
  await page.getByRole('gridcell', { name: /睡眠 8 小時/ }).click();
  await expect(page.getByText('訓練 3 組')).toBeVisible();
  await page.getByRole('button', { name: '上個月' }).click();
  await expect(page.getByRole('gridcell', { name: /睡眠 8 小時/ })).toHaveCount(0);
});
