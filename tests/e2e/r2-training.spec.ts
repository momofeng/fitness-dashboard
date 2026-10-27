// Round 2 訓練小待辦：遞減組、EZ 槓與磅制槓片示意、次數區間覆寫、暖身與停滯參數。
import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalOverflow, onboard, putRows, readAll } from './helpers';

const LB = 2.2046226218;

async function freeWorkoutWith(page: Page, search: string, name: RegExp) {
  await page.goto('./#/train');
  await page.getByRole('button', { name: '不照課表，自由訓練' }).click();
  await expect(page).toHaveURL(/#\/train\/session\//);
  await page.getByRole('button', { name: '新增動作' }).click();
  await page.getByLabel('搜尋動作').fill(search);
  await page.getByRole('button', { name }).first().click();
}

test('遞減組：正式組後可加遞減組，存成 drop、不算正式組', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await onboard(page);
  await page.goto('./#/train');
  await page.getByRole('button', { name: '開始訓練' }).click();
  const squat = page.getByRole('region', { name: '槓鈴深蹲' });
  const dropBtn = squat.getByRole('button', { name: '遞減組', exact: true });
  await expect(dropBtn).toBeDisabled();
  await squat.getByLabel('第 1 組重量').fill('60');
  await squat.getByRole('button', { name: '完成第 1 組' }).click();
  await dropBtn.click();
  // 預設是上一組的 80%（60 → 47.5，對齊 2.5 kg）
  await expect(squat.getByLabel('遞減組 1重量')).toHaveValue('47.5');
  await expectNoHorizontalOverflow(page, '訓練中＋遞減組');
  await squat.getByRole('button', { name: '完成遞減組 1' }).click();
  await expect(squat.getByRole('button', { name: '編輯遞減組 1' })).toBeVisible();
  // 正式組進度不變：第 2 組仍是下一組
  await expect(squat.getByRole('button', { name: '完成第 2 組' })).toBeEnabled();
  const sets = await readAll<{ kind: string; weightKg: number }>(page, 'sets');
  expect(sets.map((s) => [s.kind, s.weightKg]).sort()).toEqual([
    ['drop', 47.5],
    ['working', 60],
  ]);
});

test('EZ 槓：槓片示意用 EZ 槓重', async ({ page }) => {
  await onboard(page);
  await putRows(page, 'progressionState', [{ exerciseId: 'ez-bar-curl', workingWeightKg: 30, consecutiveFails: 0, deloadCount: 0, updatedAt: 1 }]);
  await freeWorkoutWith(page, 'EZ 槓彎舉', /^EZ 槓彎舉/);
  const card = page.getByRole('region', { name: 'EZ 槓彎舉' });
  // 30 kg − 10 kg EZ 槓 = 每側 10 kg
  await expect(card.getByRole('button', { name: '槓片配重' })).toContainText('每側 10 kg');
});

test('磅制：槓片示意改用 lb 槓與 lb 槓片；設定頁顯示 lb 槓片', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/settings');
  await page.getByRole('radio', { name: '磅 lb' }).click();
  await expect(page.getByLabel('45 磅槓片對數')).toBeVisible();
  await expect(page.getByLabel('槓重', { exact: true })).toHaveValue('45');
  await expectNoHorizontalOverflow(page, '設定（磅制）');

  await putRows(page, 'progressionState', [{ exerciseId: 'barbell-back-squat', workingWeightKg: 135 / LB, consecutiveFails: 0, deloadCount: 0, updatedAt: 1 }]);
  await page.goto('./#/train');
  await page.getByRole('button', { name: '開始訓練' }).click();
  const squat = page.getByRole('region', { name: '槓鈴深蹲' });
  // 135 lb − 45 lb 槓 = 每側 45 lb（一片 45 lb）
  await expect(squat.getByRole('button', { name: '槓片配重' })).toContainText('每側 45 lb');
  await expect(squat.getByRole('img', { name: '每側：45 lb' })).toBeVisible();
});

test('次數區間覆寫：動作頁設 12–15 → 訓練時採用', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/train/exercise/dumbbell-curl');
  await page.getByLabel('次數下限').fill('15');
  await page.getByLabel('次數上限').fill('12');
  await page.getByLabel('次數上限').blur();
  await expect(page.getByText('下限不能大於上限')).toBeVisible();
  await page.getByLabel('次數下限').fill('12');
  await page.getByLabel('次數上限').fill('15');
  await page.getByLabel('次數上限').blur();
  await expect(page.getByText('已覆寫課表：12–15 下')).toBeVisible();

  await freeWorkoutWith(page, '啞鈴彎舉', /^啞鈴彎舉/);
  await expect(page.getByRole('region', { name: '啞鈴彎舉' })).toContainText('× 12–15 下');
});

test('暖身方案與停滯門檻可在設定頁調整，工具頁跟著改', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/settings');
  await page.getByLabel('停滯門檻百分比').fill('2');
  await page.getByLabel('停滯門檻百分比').blur();
  await page.getByLabel('空槓組次數').fill('0');
  await page.getByLabel('空槓組次數').blur();
  await page.getByRole('button', { name: '移除暖身第 1 步' }).click();
  await expect(page.getByLabel('暖身第 1 步百分比')).toHaveValue('60');
  await expectNoHorizontalOverflow(page, '設定（暖身）');
  const s = (await readAll<{ training: { stallThresholdPct: number; warmup: { barReps: number; steps: unknown[] } } }>(page, 'settings'))[0]!;
  expect(s.training.stallThresholdPct).toBe(2);
  expect(s.training.warmup).toEqual({ barReps: 0, steps: [{ pct: 60, reps: 3 }, { pct: 80, reps: 2 }] });

  await page.goto('./#/tools');
  await page.getByRole('tab', { name: '暖身組' }).click();
  // 80 kg：60% = 47.5、80% = 65，沒有空槓組
  await expect(page.getByText('暖身 1')).toBeVisible();
  await expect(page.getByText('47.5 kg × 3')).toBeVisible();
  await expect(page.getByText('65 kg × 2')).toBeVisible();
  await expect(page.getByText('暖身 3')).toHaveCount(0);
});
