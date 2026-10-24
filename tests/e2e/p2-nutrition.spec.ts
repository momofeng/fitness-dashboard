import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, onboard, readAll } from './helpers';

test('離線搜尋「雞胸」→ 加 150 g → 當日合計正確', async ({ page, context }) => {
  await onboard(page);
  // 先讓 SW 接手並預先快取食物資料庫
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);

  await page.goto('./#/eat/add?meal=lunch');
  await page.getByLabel('搜尋食物').fill('雞胸');
  await page.getByRole('button', { name: /^去皮清肉\(肉雞\)/ }).click();
  await page.getByRole('spinbutton', { name: '份量' }).or(page.getByLabel('份量')).first().fill('150');
  await expect(page.getByText('175.5').or(page.getByText('176')).first()).toBeVisible();
  await page.getByRole('button', { name: '加入午餐' }).click();
  await expect(page.getByText('已加入午餐：去皮清肉(肉雞)')).toBeVisible();

  await page.goto('./#/eat');
  const lunch = page.getByRole('region', { name: '午餐' });
  await expect(lunch.getByText('去皮清肉(肉雞)')).toBeVisible();
  await expect(lunch.getByText('150 g')).toBeVisible();
  await expect(page.getByText(/已吃\s*176/)).toBeVisible();

  const logs = await readAll<{ kcal: number; protein: number; per: { kcal: number } }>(page, 'foodLogs');
  expect(logs).toHaveLength(1);
  expect(logs[0]!.kcal).toBeCloseTo(175.5, 5);
  expect(logs[0]!.protein).toBeCloseTo(34.95, 5);
  expect(logs[0]!.per.kcal).toBe(117);
  await context.setOffline(false);
});

test('自建食物（每一份量）→ 用份數記錄；快速加入；改份量；刪除後復原', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/eat/add?meal=post');
  await page.getByRole('button', { name: '依營養標示新增' }).click();
  await page.getByLabel('名稱', { exact: true }).fill('乳清蛋白（巧克力）');
  await page.getByLabel('一份幾克').fill('30');
  await page.getByLabel('熱量', { exact: true }).fill('120');
  await page.getByLabel('蛋白質', { exact: true }).fill('24');
  await page.getByLabel('脂肪', { exact: true }).fill('1.5');
  await page.getByLabel('碳水化合物', { exact: true }).fill('3');
  await page.getByRole('button', { name: '儲存' }).click();
  // 存完直接開份量視窗，預設 1 份
  await page.getByRole('button', { name: '加入練後' }).click();

  await page.goto('./#/eat');
  await page.getByRole('button', { name: '快速加入熱量' }).click();
  await page.getByLabel('名稱（選填）').fill('雞腿便當');
  await page.getByLabel('熱量', { exact: true }).fill('850');
  await page.getByLabel('蛋白質', { exact: true }).fill('35');
  await page.getByRole('button', { name: /^加入/ }).click();
  await expect(page.getByText(/已吃\s*970/)).toBeVisible();

  // 改份量：乳清 2 份
  await page.getByRole('button', { name: /乳清蛋白（巧克力）/ }).click();
  await page.getByLabel('份量').fill('2');
  await page.getByRole('button', { name: '儲存份量' }).click();
  await expect(page.getByText(/已吃\s*1,090/)).toBeVisible();

  // 刪除後復原
  await page.getByRole('button', { name: /雞腿便當/ }).click();
  await page.getByRole('button', { name: '刪除' }).click();
  await expect(page.getByText(/已吃\s*240/)).toBeVisible();
  await page.getByRole('button', { name: '復原' }).click();
  await expect(page.getByText(/已吃\s*1,090/)).toBeVisible();
});

test('喝水、存成餐點組合、複製前一天', async ({ page }) => {
  await onboard(page);
  await page.goto('./#/eat');
  await page.getByRole('button', { name: '+500' }).click();
  await page.getByRole('button', { name: '+250' }).click();
  await expect(page.getByText('0.75')).toBeVisible();
  const daily = await readAll<{ waterMl: number }>(page, 'dailyLogs');
  expect(daily[0]?.waterMl).toBe(750);

  await page.getByRole('button', { name: '快速加入熱量' }).click();
  await page.getByLabel('熱量', { exact: true }).fill('500');
  await page.getByRole('radio', { name: '午餐' }).or(page.getByRole('button', { name: '午餐', exact: true })).first().click();
  await page.getByRole('button', { name: /^加入/ }).click();
  await expect(page.getByText(/已吃\s*500/)).toBeVisible();

  // 存成餐點組合
  await page.getByRole('button', { name: '午餐選項' }).click();
  await page.getByRole('textbox', { name: /存成餐點組合/ }).fill('固定午餐');
  await page.getByRole('button', { name: '存成組合' }).click();
  await expect(page.getByText('已存成「固定午餐」')).toBeVisible();
  expect(await readAll(page, 'mealTemplates')).toHaveLength(1);

  // 昨天記 300 kcal，回到今天複製前一天 → 800
  await page.getByRole('button', { name: '前一天', exact: true }).click();
  await page.getByRole('button', { name: '快速加入熱量' }).click();
  await page.getByLabel('熱量', { exact: true }).fill('300');
  await page.getByRole('button', { name: /^加入/ }).click();
  await expect(page.getByText(/已吃\s*300/)).toBeVisible();
  await page.getByRole('button', { name: '後一天', exact: true }).click();
  await page.getByRole('button', { name: '複製前一天', exact: true }).click();
  await expect(page.getByText(/已吃\s*800/)).toBeVisible();
  await page.getByRole('button', { name: '復原' }).click();
  await expect(page.getByText(/已吃\s*500/)).toBeVisible();

  // 餐點組合可在新增頁一鍵加入
  await page.goto('./#/eat/add?meal=dinner');
  await page.getByRole('button', { name: /固定午餐/ }).click();
  await page.getByRole('button', { name: /^加入 1 樣/ }).click();
  await expect(page.getByText(/已吃\s*1,000/)).toBeVisible();
});

test('飲食頁面在 375px 沒有水平捲動', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await onboard(page);
  for (const hash of ['#/eat', '#/eat/add?meal=lunch', '#/eat/foods', '#/eat/week']) {
    await page.goto(`./${hash}`);
    await page.waitForLoadState('networkidle');
    await expectNoHorizontalOverflow(page, hash);
  }
  await page.goto('./#/eat/add?meal=lunch');
  await page.getByLabel('搜尋食物').fill('豆漿');
  await expect(page.getByRole('button', { name: /^豆漿/ }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page, 'search results');
});
