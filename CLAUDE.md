# 增肌健身 Dashboard（離線 PWA）

給新手增肌用的訓練／飲食／身體紀錄 App。Android 手機安裝的 PWA，資料只存在裝置的 IndexedDB，部署在 GitHub Pages。
完整計畫：`C:\Users\Administrator\.claude\plans\dashboard-twinkling-gray.md`（Round 1）、`zesty-meandering-puffin.md`（Round 2）。

## 驗證指令（改完一定要跑）
- `npm run typecheck`：TypeScript 7 strict
- `npm run test`：Vitest（`src/**/*.test.ts`、`tests/unit/`），含 fake-indexeddb 的備份往返
- `npm run build`
- `npm run e2e`：Playwright，自動 build＋`vite preview`，base path 與正式站相同（`/fitness-dashboard/`），Pixel 7 模擬
  - 本機沒有 Playwright 對應版本的 Chromium 時，設定會自動改用 `%LOCALAPPDATA%\ms-playwright` 裡最新的一版；也可用 `PW_CHROMIUM` 指定
  - 截圖給人看：`SCREENS=1 npx playwright test screens`（輸出到 `build/screens/`，可用 `SCREENS_ROUTES` 指定路由）
  - 新 spec 要用 `--repeat-each 4` 跑過才算穩定
  - e2e 用 `putRows` 直接寫 IndexedDB 後要 `page.reload()`：Dexie 的查詢快取不知道外部寫入，同一個查詢會拿到舊結果
  - 條碼：用 init script 模擬 `BarcodeDetector` 與 `getUserMedia`（canvas stream），見 `tests/e2e/r2-barcode.spec.ts`

## 架構規則
- `src/core/`：純函式（計算、日期、單位、搜尋），不得 import React／Dexie／DOM；`tests/unit/architecture.test.ts` 會檢查
- `src/content/`：內建動作庫（125 個）、課表範本。內容放程式裡、不寫進 DB；`content.test.ts` 驗證引用與每週組數
- `src/db/`：Dexie schema（`db.ts`）、Zod schemas（`schemas.ts`，同時是型別來源）、`repo/`、`backup/`
- `src/features/`：各頁面；`src/ui/`：共用元件；`src/lib/`：平台 API 包裝
- 一律存 kg／cm／kcal／ml，日期為本地 `YYYY-MM-DD`（有「日切換時間」）
- 飲食紀錄存營養快照，改食物或資料庫改版不影響歷史
- 訓練中每記一組就寫進 DB；service worker 用 prompt 模式，訓練中不自動更新
- 數值範圍集中在 `src/db/limits.ts`，schema、輸入元件、repo 寫入前檢查三處共用；有意義的數值輸入用 `NumberInput clamp={false}` 標紅擋存，不要自動夾到上下限
- 打卡類資料用決定性主鍵（`supplementLogs`：`productId:date`、`habitLogs`：`habitId:date`），合併匯入不會重複
- 減量週的場次（`workouts.deload`）不套用進步規則
- 進度照：`photos` 存中繼資料與 240px 縮圖（data URL），`photoBlobs` 存長邊 1080 的 JPEG 原圖；兩表一起寫、一起刪。JSON 備份不含照片且匯入不動照片，ZIP 完整備份（`backup/zip.ts`）才含原圖
- 自適應 TDEE 只建議，使用者按「套用」才寫 `nutrition.tdeeOverride`
- 條碼只查自建食物（`foodsCustom.barcode`），不連外部商品資料庫

## 改資料結構時
1. `db.ts` 加新 `version(n)`，只新增表或索引，不改既有主鍵（目前是 v2）
2. 資料轉換寫成 `backup/migrate.ts` 的 `MIGRATIONS[n-1]`，並在 `MIGRATION_TABLES` 列出改到的表；Dexie upgrade 與舊備份匯入共用
3. 新增 `tests/fixtures/backup-vN.json`（v2 起另有 `backup-vN.zip`，產生腳本 `make-backup-vN.mjs`），舊版 fixture 永久保留
4. 新欄位或新表的上下限加進 `limits.ts`，並擴充 `tests/unit/r2-data.test.ts` 的「邊界值寫入 → 匯出 → 匯入」測試

## 資料來源
- 食物：衛福部食藥署「食品營養成分資料庫」（data.gov.tw 資料集 8543），政府資料開放授權條款第 1 版，須保留「關於」頁的顯名聲明
- 原始 zip 放 `data-raw/`（不進 git），轉換產物 `public/data/foods-tfda.json` 進 git
- 食物營養數字一律不由 AI 產生
- 補給品知識卡（`src/content/supplementCards.ts`）：每條功效／劑量／安全宣稱都要有 SOURCES 裡的來源（PMID 或 DOI，或 gov.tw 網址），劑量只寫來源實際寫的數字，不提品牌、不做治療或預防宣稱；改內容後要派獨立代理逐條開來源核對（2026-10-25 已核對 129 條）。PubMed 網頁會擋自動化，改用 NCBI E-utilities 或 Europe PMC 讀

## 設計
- 方向：健身房橡膠地板上的訓練日誌。深炭灰底、粉筆白文字、只用邊框不用陰影
- 顏色 token 在 `src/styles/app.css`；三大營養素沿用奧運槓片色（蛋白質紅、碳水藍、脂肪黃），已用 dataviz 驗證腳本確認深淺色都過色盲檢查
- 主要按鈕是粉筆白實心；完成狀態用綠色

## 部署
- 正式網址：https://momofeng.github.io/fitness-dashboard/（repo `momofeng/fitness-dashboard`，public）
- push 到 main 就會跑 `.github/workflows/deploy.yml`：typecheck → test → build → deploy-pages（Pages 來源為 GitHub Actions）
- 正式站驗收：`npx playwright test -c playwright.prod.config.ts`（manifest、SW 範圍、離線重新整理、離線食物搜尋）
- push 前要先問使用者；git 作者用 GitHub noreply email（repo 設定），不要用真實 email

## 後續待辦
- AI（`src/ai/provider.ts` 已預留介面）：拍照估熱量、AI 教練，範圍待使用者決定
- 待人工：Android 實機相機掃條碼、拍照方向與畫質、觸控手感、視覺；知識卡內容建議使用者再讀一次
