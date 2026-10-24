// 正式網址驗收：npx playwright test -c playwright.prod.config.ts
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testDir: 'tests/prod',
  webServer: undefined,
  workers: 1,
  timeout: 60_000,
  use: {
    ...base.use,
    ...devices['Pixel 7'],
    baseURL: process.env.PROD_URL ?? 'https://momofeng.github.io/fitness-dashboard/',
  },
});
