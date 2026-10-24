// 效能預算：首頁（已完成首次設定）首次載入的 JS，gzip 後不超過 200 KB。
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('首頁首次載入的 JS gzip ≤ 200 KB', async ({ page, context }) => {
  await onboard(page);
  // 新分頁、停用快取，模擬第一次開啟首頁
  const fresh = await context.newPage();
  await fresh.route('**/*', (route) => route.continue());
  await fresh.goto('./#/');
  await fresh.getByRole('region', { name: '今天的飲食' }).waitFor();
  await fresh.waitForLoadState('networkidle');
  const files = await fresh.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((e) => new URL(e.name).pathname)
      .filter((p) => p.endsWith('.js') && p.includes('/assets/')),
  );
  let total = 0;
  const rows: string[] = [];
  for (const f of [...new Set(files)]) {
    const local = 'dist/' + f.replace('/fitness-dashboard/', '');
    const gz = gzipSync(readFileSync(local)).length;
    total += gz;
    rows.push(`${local.split('/').pop()} ${(gz / 1024).toFixed(1)} KB`);
  }
  console.log(`首頁 JS ${rows.length} 檔，gzip 合計 ${(total / 1024).toFixed(1)} KB\n  ${rows.join('\n  ')}`);
  expect(rows.some((r) => /foods-tfda/.test(r))).toBe(false);
  expect(total).toBeLessThanOrEqual(200 * 1024);
});
