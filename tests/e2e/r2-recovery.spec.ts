// Round 2 恢復：首頁記錄睡眠／精力／痠痛；停滯＋睡眠不足 → 減量建議 → 減量週訓練不改進步狀態。
import { expect, test } from '@playwright/test';
import { appDay, doneWorkout, expectNoHorizontalOverflow, onboard, putRows, readAll } from './helpers';

test('首頁「今天狀態」：記錄睡眠、精力、痠痛', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await onboard(page);
  const card = page.getByRole('region', { name: '今天狀態' });
  await card.getByLabel('睡眠時數').fill('7.5');
  await card.getByLabel('睡眠時數').blur();
  await card.getByRole('radio', { name: '4 不錯' }).click();
  await card.getByRole('button', { name: /痠痛部位/ }).click();
  await card.getByRole('button', { name: '大腿前側', exact: true }).click();
  await expect(card.getByRole('button', { name: '大腿前側', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expectNoHorizontalOverflow(page, '首頁（今天狀態）');
  const rows = await readAll<{ date: string; sleepHours: number; energy: number; soreness: string[] }>(page, 'dailyLogs');
  expect(rows.find((r) => r.date === appDay())).toMatchObject({ sleepHours: 7.5, energy: 4, soreness: ['quads'] });

  // 打錯（25 小時）：標紅、不寫入
  await card.getByLabel('睡眠時數').fill('25');
  await card.getByLabel('睡眠時數').blur();
  await expect(card.getByLabel('睡眠時數')).toHaveAttribute('aria-invalid', 'true');
  const after = await readAll<{ date: string; sleepHours: number }>(page, 'dailyLogs');
  expect(after.find((r) => r.date === appDay())?.sleepHours).toBe(7.5);
});

test('停滯＋睡眠不足 → 建議減量週 → 新訓練組數減少、完成後進步狀態不變', async ({ page }) => {
  await onboard(page);
  // 深蹲 4 場都是 60 kg × 5（30 天沒進步），近 5 天平均睡 5 小時
  const t = Date.now() - 40 * 86400_000;
  const seeds = [-30, -20, -10, -3].map((d, i) => doneWorkout(`seed-w${i}`, appDay(d), 'barbell-back-squat', 60, [5, 5, 5], t + i * 86400_000));
  await putRows(page, 'workouts', seeds.map((s) => s.workout));
  await putRows(page, 'sets', seeds.flatMap((s) => s.sets));
  await putRows(page, 'dailyLogs', [0, -1, -2, -3, -4].map((d) => ({ date: appDay(d), waterMl: 0, sleepHours: 5, energy: 3, updatedAt: t })));
  await putRows(page, 'progressionState', [{ exerciseId: 'barbell-back-squat', workingWeightKg: 60, consecutiveFails: 2, deloadCount: 0, updatedAt: t }]);
  // 直接寫 IndexedDB 不會通知 Dexie 的查詢快取，重新載入
  await page.goto('./#/train');
  await page.reload();
  const advice = page.getByRole('region', { name: '減量建議' });
  await expect(advice).toContainText('建議安排一週減量');
  await expect(advice).toContainText('槓鈴深蹲 停滯');
  await expect(advice).toContainText('平均睡眠 5 小時');
  await page.setViewportSize({ width: 375, height: 800 });
  await expectNoHorizontalOverflow(page, '訓練首頁（減量建議）');
  await advice.getByRole('button', { name: '開始減量週（7 天）' }).click();
  await expect(page.getByRole('status').filter({ hasText: '減量週進行中' })).toBeVisible();

  await page.getByRole('button', { name: '開始訓練' }).click();
  const squat = page.getByRole('region', { name: '槓鈴深蹲' });
  // 3 組 × 60% → 2 組；60 kg × 90% = 54 → 52.5
  await expect(squat).toContainText('2 組 × 6 下');
  await expect(squat).toContainText('目標 52.5 kg');
  await squat.getByRole('button', { name: '完成第 1 組' }).click();
  await squat.getByRole('button', { name: '完成第 2 組' }).click();
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.getByRole('button', { name: '完成（減量週不調整重量）' }).click();
  await expect(page.getByText(/減量週：這場不調整重量/).first()).toBeVisible();

  const st = (await readAll<{ exerciseId: string; workingWeightKg: number; consecutiveFails: number }>(page, 'progressionState')).find((r) => r.exerciseId === 'barbell-back-squat')!;
  expect(st).toMatchObject({ workingWeightKg: 60, consecutiveFails: 2 });
  const w = (await readAll<{ id: string; deload?: boolean; status: string }>(page, 'workouts')).filter((x) => !x.id.startsWith('seed'));
  expect(w).toHaveLength(1);
  expect(w[0]).toMatchObject({ deload: true, status: 'done' });
});

test('恢復頁：14 天長條，點選看當天數字', async ({ page }) => {
  await onboard(page);
  await putRows(page, 'dailyLogs', [0, -1, -3].map((d) => ({ date: appDay(d), waterMl: 0, sleepHours: 6 + d * -0.5, energy: 3, updatedAt: 1 })));
  await page.goto('./#/recovery');
  await page.reload();
  await expect(page.getByRole('button', { name: /睡眠 6 小時/ })).toBeVisible();
  await page.getByRole('button', { name: /睡眠 7\.5 小時/ }).click();
  await expect(page.locator('figcaption')).toContainText('7.5 小時');
  await page.setViewportSize({ width: 375, height: 800 });
  await expectNoHorizontalOverflow(page, '恢復頁');
});
