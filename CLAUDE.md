# 增肌健身 Dashboard（離線 PWA）

給新手增肌用的訓練／飲食／身體紀錄 App。Android 手機安裝的 PWA，資料預設存在裝置的 IndexedDB，可選擇免帳號加密同步；前端部署在 GitHub Pages。
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
  - 對話框：用 `expectDialogButtonsInView` 檢查按鈕都在畫面內（Playwright 點擊會自動捲動，人卻按不到）；修改既有數值用 `pressSequentially` 模擬手機逐字輸入
  - 會存檔的數字欄位用 `NumberInput` 的 `onCommit`（離開欄位或按 −／＋ 才存），不要在 `onChange` 每打一字就存

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
- AI 辨識（拍照／一句話輸入；`src/ai/`、`features/nutrition/AiEntry|AiReview|PhotoFood|TextFood.tsx`）：
  - AI 只回「食物名稱＋估計公克數＋是否煮熟」（`FoodGuess` 型別沒有營養欄位，`ai/parse.ts` 只讀 name／altNames／grams／confidence／cooked，模型多給的欄位一律忽略）。營養由 `core/foodMatch.ts` 對應到資料庫食物，再經 `computeEntry` 依重量換算；寫入的 `foodLogs.source` 是 `'ai'`
  - Gemini 瀏覽器直連（`ai/gemini.ts`，金鑰放 header `x-goog-api-key`、不放網址；模型 ID 在設定可改，預設 `gemini-3.1-flash-lite`，官方最早 2027-05-07 淘汰）。金鑰只存 `localStorage`（`ai/key.ts`），**不進 IndexedDB 與備份**，「清除全部資料」會一併清掉；`settings.ai.enabled` 就是「已了解照片會送到 Google」的同意
  - 照片縮到長邊 1024 的 JPEG（去 EXIF／GPS）才送出，辨識完即丟、不存；進度照永遠不上傳。隱私文案在 README、關於頁、首次設定頁、設定頁 AI 區塊
  - 「記住我的校正」存在 `aiMatches` 表（Dexie v3，納入備份，上限 2,000 筆）。只靠名稱片段猜到的對應（`via:'partial'`）預設不勾選
  - 資料庫多數只有「生」的樣品（975 筆生、約 59 筆熟）：AI 說煮熟了但只對到生的樣品時，確認清單會警告
  - AI 程式碼（`gemini.ts`、`PhotoFood`、`TextFood`、`AiReview`）一律動態載入，首頁 JS 預算（`budget.spec.ts`）不能因此超標
  - 測試一律 mock，**不打真實 API**（花錢）：e2e 見 `tests/e2e/r3-photofood.spec.ts`（`context.route` 攔截 `generativelanguage.googleapis.com`）

## 改資料結構時
1. `db.ts` 加新 `version(n)`，只新增表或索引，不改既有主鍵（目前是 v4；v3 新增 `aiMatches`，v4 新增訓練欄位與項目識別）
2. 資料轉換寫成 `backup/migrate.ts` 的 `MIGRATIONS[n-1]`，並在 `MIGRATION_TABLES` 列出改到的表；Dexie upgrade 與舊備份匯入共用
3. 新增 `tests/fixtures/backup-vN.json`（v2 起另有 `backup-vN.zip`，產生腳本 `make-backup-vN.mjs`），舊版 fixture 永久保留
4. 新欄位或新表的上下限加進 `limits.ts`，並擴充 `tests/unit/r2-data.test.ts` 的「邊界值寫入 → 匯出 → 匯入」測試

## 資料來源
- 食物：衛福部食藥署「食品營養成分資料庫」（data.gov.tw 資料集 8543），政府資料開放授權條款第 1 版，須保留「關於」頁的顯名聲明
- 原始 zip 放 `data-raw/`（不進 git），轉換產物 `public/data/foods-tfda.json` 進 git
- 食物營養數字一律不由 AI 產生（AI 辨識只提供名稱與重量，見「架構規則」）
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
- AI 教練（`src/ai/provider.ts` 的 `coach` 仍是未實作的介面），範圍待使用者決定
- 待人工：Android 實機相機掃條碼、拍照方向與畫質、觸控手感、視覺；知識卡內容建議使用者再讀一次
- 待人工（AI 辨識）：用自己的 Gemini 金鑰實際拍幾餐，看辨識準確度與重量估計誤差；新建的 AI Studio 金鑰能否在 Google 端限制網站來源；免費層實際額度


## 訓練紀錄 v4
- core/training/logging.ts 統一狀態、重量定義、項目歸屬與需注意判定；未註記不推估動作品質或 RIR。
- 新場次每個 plan item 有穩定 id，sets 以 planItemId + position 歸屬；setId 重試具冪等性。草稿放 workouts.drafts，不算正式組。
- 器械版本沿用自建動作的獨立 exerciseId，進步狀態主鍵不變；context 與名稱在開始時快照。
- 姿勢不穩、協助、不適：保留完成量、排除力量 PR，該動作本場不調重量／失敗計數。hard 單獨不阻擋。
- 歷史更正／撤銷標 correctedAt，摘要失效重算，既有 progressionState 不倒推；手動確認下一次重量有獨立入口。
- 摘要以 core/training/report 的同一份 section 資料產生文字與圖片；未完成場次不分享。Canvas 圖片與 Zod 寫入驗證延遲載入，首頁 gzip 仍需 ≤200 KB。
- 新回歸：tests/unit/r4-training-log.test.ts、tests/e2e/r4-training-log.spec.ts（新增 spec 須 repeat-each 4）。

## 免帳號加密同步 v0.5
- src/sync：Web Crypto HKDF 分離 endpoint-bound id／auth／AES-GCM key，AAD 綁定 vault 與版本；恢復金鑰不上傳。PAIR1 配對採獨立金鑰、5 分鐘單次使用。
- 同步憑證在 localStorage，同步 base 在獨立 IndexedDB；兩者不進一般備份。主資料庫仍 v4。
- 只同步完成場次；草稿、照片、AI API 金鑰、裝置偏好不進雲端。所有資料先經既有備份驗證器。
- core/syncMerge.ts 是逐筆三方合併，編輯／編輯與刪除／編輯要求使用者選擇；維持 workout/set、product/log、habit/log 父子關聯與唯一啟用課表。
- engine.ts 以 Web Locks、共享 epoch 與交易 guard 防多分頁競態。清除、JSON／ZIP 匯入需包在 withSyncStopped，等待所有在途操作結束。
- sync-service 是 Sites Vinext／Cloudflare Worker，D1 schema 在 db/schema.ts、提交 drizzle migration；R2 只收加密內容。不可手動重建已套用 migration，不可移除 sites()。
- 後端永遠不記錄 bearer、恢復金鑰或明文。支援 CAS If-Match；模糊的提交錯誤先確認 head，不能直接刪掉可能已提交的 R2 object。
- 測試：tests/unit/sync.test.ts；tests/e2e/r5-sync.spec.ts。Playwright 自啟 tests/support/sync-server.mts（8789）；真實本機 Worker（8788）另行 smoke test。只用測試資料，不打雲端。
- 同步服務與前端需一起發布；沿用本檔 push 前先詢問規則。Sites 後端需公開 API 才能免帳號使用，資料存取仍由金鑰保護。
