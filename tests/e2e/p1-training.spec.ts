import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalOverflow, onboard, readAll } from './helpers';

async function completeSets(page: Page, exercise: string, count: number, weight?: string) {
  const card = page.getByRole('region', { name: exercise });
  for (let i = 1; i <= count; i++) {
    if (weight && i === 1) await card.getByLabel(`第 ${i} 組重量`).fill(weight);
    await card.getByRole('button', { name: `完成第 ${i} 組` }).click();
    await expect(card.getByRole('button', { name: `編輯第 ${i} 組`, includeHidden: true })).toBeAttached();
  }
}

test('完整訓練：記組 → 重新整理後接續 → 完成 → 下次加重 → 第二次出現 PR', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/train');
  await expect(page.getByText('全身 A', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: '開始訓練' }).click();
  await expect(page).toHaveURL(/#\/train\/session\//);

  const squat = page.getByRole('region', { name: '槓鈴深蹲' });
  await expect(squat).toBeVisible();
  // 第一次沒有目標重量：完成鈕在填重量前不能按
  await expect(squat.getByRole('button', { name: '完成第 1 組' })).toBeDisabled();
  await squat.getByLabel('第 1 組重量').fill('60');
  await expect(squat.getByLabel('第 1 組次數')).toHaveValue('6');
  await squat.getByRole('button', { name: '完成第 1 組' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  // 第 2 組沿用上一組的重量
  await expect(squat.getByLabel('第 2 組重量')).toHaveValue('60');
  await squat.getByRole('button', { name: '完成第 2 組' }).click();

  // 中途重新整理：已記錄的組還在
  await page.reload();
  await expect(squat.getByRole('button', { name: '編輯第 1 組' })).toBeVisible();
  await expect(squat.getByRole('button', { name: '編輯第 2 組' })).toBeVisible();
  await squat.getByRole('button', { name: '完成第 3 組' }).click();

  // 其他動作也記一些
  await completeSets(page, '槓鈴臥推', 3, '40');
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.getByRole('button', { name: '完成並計算下次重量' }).click();
  await expect(page.getByText('下次怎麼練')).toBeVisible();
  await expect(page.getByText('下次加到 62.5 kg')).toBeVisible();
  await page.getByRole('button', { name: '查看這場紀錄' }).click();
  await expect(page).toHaveURL(/#\/train\/history\//);

  const state = await readAll<{ exerciseId: string; workingWeightKg: number }>(page, 'progressionState');
  expect(state.find((s) => s.exerciseId === 'barbell-back-squat')?.workingWeightKg).toBe(62.5);

  // 下一次預設是 B；切回 A 看到深蹲目標 62.5
  await page.goto('./#/train');
  await expect(page.getByText('全身 B', { exact: true }).first()).toBeVisible();
  await page.getByRole('radio', { name: '全身 A' }).click();
  await expect(page.getByText('62.5 kg').first()).toBeVisible();
  await page.getByRole('button', { name: '開始訓練' }).click();
  await expect(squat.getByLabel('第 1 組重量')).toHaveValue('62.5');
  await completeSets(page, '槓鈴深蹲', 3);
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.getByRole('button', { name: '完成並計算下次重量' }).click();
  await expect(page.getByText('新紀錄')).toBeVisible();
  await expect(page.getByText(/槓鈴深蹲：估計 1RM/)).toBeVisible();
});

test('取消已完成的組可以復原；放棄訓練會刪除', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/train');
  await page.getByRole('button', { name: '開始訓練' }).click();
  const squat = page.getByRole('region', { name: '槓鈴深蹲' });
  await squat.getByLabel('第 1 組重量').fill('50');
  await squat.getByRole('button', { name: '完成第 1 組' }).click();
  await squat.getByRole('button', { name: '編輯第 1 組' }).click();
  await page.getByRole('button', { name: '撤銷這組' }).click();
  await expect(squat.getByRole('button', { name: '完成第 1 組' })).toBeVisible();
  await page.getByRole('button', { name: '復原' }).click();
  await expect(squat.getByRole('button', { name: '編輯第 1 組' })).toBeVisible();

  await page.getByRole('button', { name: '放棄這場訓練' }).click();
  await page.getByRole('button', { name: '放棄並刪除' }).click();
  await expect(page).toHaveURL(/#\/train$/);
  expect(await readAll(page, 'sets')).toHaveLength(0);
  expect(await readAll(page, 'workouts')).toHaveLength(0);
});

test('自由訓練：加入動作、槓片示意、訓練中切到其他頁仍可回來', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/train');
  await page.getByRole('button', { name: '不照課表，自由訓練' }).click();
  await page.getByRole('button', { name: '新增動作' }).click();
  await page.getByLabel('搜尋動作').fill('臥推');
  await page.getByRole('button', { name: /^槓鈴臥推/ }).click();
  const bench = page.getByRole('region', { name: '槓鈴臥推' });
  await expect(bench).toBeVisible();
  await bench.getByLabel('第 1 組重量').fill('60');
  await bench.getByRole('button', { name: '完成第 1 組' }).click();

  // 回到首頁，浮動提示可回到訓練
  await page.getByRole('button', { name: '回訓練頁（訓練會保留）' }).click();
  await page.goto('./#/eat');
  await page.getByRole('link', { name: /自由訓練進行中/ }).click();
  await expect(bench.getByRole('button', { name: '編輯第 1 組' })).toBeVisible();
});

test('訓練相關頁面在 375px 沒有水平捲動', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await onboard(page);
  await page.goto('./#/train');
  await page.getByRole('button', { name: '開始訓練' }).click();
  await expect(page.getByRole('region', { name: '槓鈴深蹲' })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'session');
  await page.getByRole('button', { name: '放棄這場訓練' }).click();
  await page.getByRole('button', { name: '放棄並刪除' }).click();
  for (const hash of ['#/train', '#/train/program', '#/train/exercises', '#/train/exercise/barbell-back-squat', '#/train/history', '#/train/cardio']) {
    await page.goto(`./${hash}`);
    await page.waitForLoadState('networkidle');
    await expectNoHorizontalOverflow(page, hash);
  }
});
