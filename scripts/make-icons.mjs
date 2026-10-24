// 由 public/icons/icon.svg 產生 PWA 需要的 PNG 圖示。
// 用法：node scripts/make-icons.mjs（需要 Playwright 的 Chromium；可用 PW_CHROMIUM 指定執行檔）
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const dir = new URL('../public/icons/', import.meta.url);
const svg = readFileSync(new URL('icon.svg', dir), 'utf8');
// maskable：Android 會裁成圓形或圓角方形，內容要在中央 80% 的安全區內，底色鋪滿
const maskable = svg.replace('rx="112"', 'rx="0"').replace('<rect x="64"', '<g transform="translate(51.2 51.2) scale(0.8)"><rect x="64"').replace('</svg>', '</g></svg>');

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function render(markup, size, file, transparentCorners) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:${transparentCorners ? 'transparent' : '#0e0f11'}">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  await page.screenshot({ path: fileURLToPath(new URL(file, dir)), omitBackground: transparentCorners });
  console.log('wrote', file);
}

await render(svg, 192, 'icon-192.png', true);
await render(svg, 512, 'icon-512.png', true);
await render(maskable, 512, 'icon-maskable-512.png', false);
await render(svg.replace('rx="112"', 'rx="0"'), 180, 'apple-touch-icon.png', false);
await browser.close();
