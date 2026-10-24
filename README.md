# 增肌日誌（離線健身 PWA）

給增肌新手用的訓練、飲食、身體數據紀錄 App。可以加到 Android 手機主畫面，離線也能用；**所有紀錄只存在你自己的裝置**（瀏覽器 IndexedDB），不會上傳。

- 使用：<https://momofeng.github.io/fitness-dashboard/>（用 Android Chrome 開啟 → 選單「加到主畫面」）
- 換手機前請到「更多 → 資料與備份」匯出備份檔，新手機在首次設定頁選「從備份檔還原」

## 功能
- **訓練**：新手全身課表等 4 套範本、訓練中模式（預填目標重量、一鍵完成並休息倒數、暖身組、槓片配重）、線性／雙重進步自動加重、停滯提醒、PR 與 1RM 趨勢、每肌群每週組數、有氧紀錄、125 個動作的動作庫
- **飲食**：依 Mifflin-St Jeor 估算熱量與增肌目標、內建衛福部食物資料庫（2,160 筆原型食物）、自建食物、餐點組合、快速加入熱量、複製前一天、喝水、每週摘要
- **身體**：體重 7 日均線與週增重率（含速度判讀）、體脂與 FFMI、圍度
- **其他**：首頁總覽、小工具（1RM、槓片、暖身組、TDEE）、JSON 備份還原、CSV 匯出

所有數字都是公式估算，不是醫療或營養建議。

## 開發
```bash
npm install
npm run dev        # http://localhost:5173/fitness-dashboard/
npm run verify     # typecheck + 單元測試 + build
npm run e2e        # Playwright（Pixel 7 模擬，含離線）
```
技術：Vite、React、TypeScript、Tailwind CSS、Dexie（IndexedDB）、vite-plugin-pwa、Recharts、Zod。

更新食物資料庫：從[政府資料開放平臺資料集 8543](https://data.gov.tw/dataset/8543)下載 JSON zip 放到 `data-raw/tfda-20-json.zip`，執行 `node scripts/tfda/convert.ts --version "YYYY-MM-DD 版"`。轉換會檢查單位、缺值、熱量一致性（修正熱量）與成分加總，不通過就不寫檔。

## 資料來源與授權
食物營養資料：衛生福利部食品藥物管理署「食品營養成分資料庫」（政府資料開放平臺資料集 8543），依[政府資料開放授權條款－第1版](https://data.gov.tw/license)釋出，本專案依該條款進行利用。
