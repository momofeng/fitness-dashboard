import { expect, test } from '@playwright/test';
import { onboard } from '../e2e/helpers';

test('正式網址：manifest、SW 註冊、離線重新整理與食物搜尋', async ({ page, context }) => {
  await page.goto('./');
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.getAttribute('href');
    if (!href) return null;
    const res = await fetch(href);
    return { status: res.status, json: await res.json() };
  });
  expect(manifest?.status).toBe(200);
  expect(manifest?.json.start_url).toBeTruthy();
  expect(manifest?.json.icons.some((i: { sizes: string; purpose?: string }) => i.purpose === 'maskable')).toBe(true);

  await onboard(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 20_000 }).toBe(true);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope);
  expect(scope).toMatch(/\/fitness-dashboard\/$/);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('navigation', { name: '主要分頁' })).toBeVisible();
  await page.goto('./#/train');
  await expect(page.getByRole('heading', { level: 1, name: '訓練', exact: true })).toBeVisible();
  await page.goto('./#/eat/add?meal=lunch');
  await page.getByLabel('搜尋食物').fill('雞胸');
  await expect(page.getByRole('button', { name: /^去皮清肉\(肉雞\)/ })).toBeVisible();
  await context.setOffline(false);
});
