import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// 可用 PW_CHROMIUM 指定 Chromium；沒指定就用 Playwright 預設，找不到時退回本機快取中最新的一版
function chromiumPath(): string | undefined {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  if (process.env.CI) return undefined;
  const root = join(process.env.LOCALAPPDATA ?? '', 'ms-playwright');
  if (!existsSync(root)) return undefined;
  const dirs = readdirSync(root)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const d of dirs) {
    const exe = join(root, d, 'chrome-win64', 'chrome.exe');
    if (existsSync(exe)) return exe;
  }
  return undefined;
}

const PORT = 4173;
const BASE = `http://localhost:${PORT}/fitness-dashboard/`;

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  // 本機在 HDD 上同時啟動 4 個 Chromium 偶爾會啟動逾時，降到 2
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [['list']],
  use: {
    ...devices['Pixel 7'],
    baseURL: BASE,
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    trace: 'retain-on-failure',
    launchOptions: { executablePath: chromiumPath() },
  },
  webServer: {
    // 與 GitHub Pages 相同的 base path，並使用正式 build（含 service worker）
    command: 'npx vite build && npx vite preview --port 4173 --strictPort',
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
