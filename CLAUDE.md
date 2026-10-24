# 增肌健身 Dashboard（離線 PWA）

給新手增肌用的訓練／飲食／身體紀錄 App。Android 手機安裝的 PWA，資料只存在裝置的 IndexedDB，部署在 GitHub Pages。
完整計畫：`C:\Users\Administrator\.claude\plans\dashboard-twinkling-gray.md`。

## 驗證指令（改完一定要跑）
- `npm run typecheck`：TypeScript 7 strict
- `npm run test`：Vitest（`src/**/*.test.ts`、`tests/unit/`），含 fake-indexeddb 的備份往返
- `npm run build`
- `npm run e2e`：Playwright，自動 build＋`vite preview`，base path 與正式站相同（`/fitness-dashboard/`），Pixel 7 模擬
  - 本機沒有 Playwright 對應版本的 Chromium 時，設定會自動改用 `%LOCALAPPDATA%\ms-playwright` 裡最新的一版；也可用 `PW_CHROMIUM` 指定
  - 截圖給人看：`SCREENS=1 npx playwright test screens`（輸出到 `build/screens/`，可用 `SCREENS_ROUTES` 指定路由）

## 架構規則
- `src/core/`：純函式（計算、日期、單位、搜尋），不得 import React／Dexie／DOM；`tests/unit/architecture.test.ts` 會檢查
- `src/content/`：內建動作庫（125 個）、課表範本。內容放程式裡、不寫進 DB；`content.test.ts` 驗證引用與每週組數
- `src/db/`：Dexie schema（`db.ts`）、Zod schemas（`schemas.ts`，同時是型別來源）、`repo/`、`backup/`
- `src/features/`：各頁面；`src/ui/`：共用元件；`src/lib/`：平台 API 包裝
- 一律存 kg／cm／kcal／ml，日期為本地 `YYYY-MM-DD`（有「日切換時間」）
- 飲食紀錄存營養快照，改食物或資料庫改版不影響歷史
- 訓練中每記一組就寫進 DB；service worker 用 prompt 模式，訓練中不自動更新

## 改資料結構時
1. `db.ts` 加新 `version(n)`，只新增表或索引，不改既有主鍵
2. 資料轉換寫成 `backup/migrate.ts` 的 `MIGRATIONS[n-1]`，Dexie upgrade 與舊備份匯入共用
3. 新增 `tests/fixtures/backup-vN.json`，舊版 fixture 永久保留

## 資料來源
- 食物：衛福部食藥署「食品營養成分資料庫」（data.gov.tw 資料集 8543），政府資料開放授權條款第 1 版，須保留「關於」頁的顯名聲明
- 原始 zip 放 `data-raw/`（不進 git），轉換產物 `public/data/foods-tfda.json` 進 git
- 食物營養數字一律不由 AI 產生

## 設計
- 方向：健身房橡膠地板上的訓練日誌。深炭灰底、粉筆白文字、只用邊框不用陰影
- 顏色 token 在 `src/styles/app.css`；三大營養素沿用奧運槓片色（蛋白質紅、碳水藍、脂肪黃），已用 dataviz 驗證腳本確認深淺色都過色盲檢查
- 主要按鈕是粉筆白實心；完成狀態用綠色

## 部署
- 正式網址：https://momofeng.github.io/fitness-dashboard/（repo `momofeng/fitness-dashboard`，public）
- push 到 main 就會跑 `.github/workflows/deploy.yml`：typecheck → test → build → deploy-pages（Pages 來源為 GitHub Actions）
- 正式站驗收：`npx playwright test -c playwright.prod.config.ts`（manifest、SW 範圍、離線重新整理、離線食物搜尋）
- push 前要先問使用者；git 作者用 GitHub noreply email（repo 設定），不要用真實 email

## Round 2 待辦
選品（補給品知識卡、我的產品 CP 值、庫存、打卡、裝備）、恢復（睡眠、狀態、減量建議）、目標與習慣、月曆熱圖、進度照（ZIP 備份）、自適應 TDEE、條碼掃描、AI（`src/ai/provider.ts` 已預留介面）
