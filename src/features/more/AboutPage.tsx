import { Link } from 'react-router';
import { SUPPLEMENT_DISCLAIMER } from '../../content/supplementCards';
import { PageHeader, Section } from '../../ui/Layout';
import { GradeLegend } from '../shop/SupplementsPage';

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title="關於與資料來源" back="/more" />

      <Section title="隱私">
        <div className="card flex flex-col gap-2 p-4 text-base text-chalk-2">
          <p>你的訓練、飲食與身體數據只存在這個瀏覽器的 IndexedDB，預設不會上傳到任何伺服器。</p>
          <p>你可選擇啟用「加密雲端同步」：已完成訓練、飲食、身體數據與課表會先在裝置加密再上傳。恢復金鑰、進行中的訓練、進度照與 AI API 金鑰不會進入同步資料；持有恢復金鑰者可解密並讀寫紀錄。你也可自己啟用「AI 辨識」：拍照或一句話輸入時，縮小並去掉拍攝位置的照片（或你輸入的文字）會送到 Google Gemini 辨識食物名稱與估計重量，照片不會存下來；熱量與營養仍由內建的食物資料庫計算。金鑰只存在這支手機，不會進備份檔。進度照永遠不會上傳。</p>
          <p>進度照也只存在這支手機；存檔時會重新編碼，去掉拍攝位置等資訊。一般 JSON 備份不含照片，ZIP 完整備份才有，分享 ZIP 檔時請留意對象。</p>
          <p>條碼掃描只在手機上辨識，不會把條碼送到網路上查詢。</p>
          <p>App 放在 GitHub Pages。同一個 github.io 帳號網域下的其他頁面與本 App 屬於同一個來源，技術上讀得到這裡的瀏覽器資料；目前該網域只有本 App，資料庫名稱也獨立，若之後要放其他網頁，建議改用自訂網域隔開。</p>
        </div>
      </Section>

      <Section title="免責聲明">
        <div className="card flex flex-col gap-2 p-4 text-base text-chalk-2">
          <p>熱量、巨量營養素、1RM 與加重建議皆依公開公式估算，僅供參考，不構成醫療、營養或運動處方建議。</p>
          <p>有傷病、慢性病、懷孕或特殊飲食需求，請先諮詢醫師或合格專業人員。訓練時請注意動作安全，必要時找人協助保護。</p>
        </div>
      </Section>

      <Section title="補給品知識卡的證據等級">
        <div className="card flex flex-col gap-3 p-4">
          <GradeLegend />
          <p className="text-sm text-chalk-3">
            每條功效、劑量與安全說法都附國際運動營養學會（ISSN）、國際奧會（IOC）共識、PubMed（PMID／DOI）或台灣政府機關的來源，可在
            <Link to="/supplements" className="text-chalk-2 underline decoration-chalk-4 underline-offset-2">
              知識卡
            </Link>
            逐條點開。卡片不提任何品牌。
          </p>
          <p className="text-sm text-chalk-3">{SUPPLEMENT_DISCLAIMER}</p>
        </div>
      </Section>

      <Section title="資料來源與授權">
        <div className="card flex flex-col gap-3 p-4 text-base text-chalk-2">
          <div>
            <p className="font-medium text-chalk">食品營養成分資料庫</p>
            <p>
              提供機關：衛生福利部食品藥物管理署。資料集：食品營養成分資料庫（政府資料開放平臺資料集 8543）。此開放資料依
              <a className="text-chalk underline decoration-chalk-4 underline-offset-2" href="https://data.gov.tw/license" target="_blank" rel="noreferrer">
                政府資料開放授權條款－第1版
              </a>
              釋出，使用者得基於授權條款進行利用。App 內的版本日期顯示於食物搜尋頁。
            </p>
          </div>
          <div>
            <p className="font-medium text-chalk">計算公式</p>
            <ul className="list-disc pl-5">
              <li>基礎代謝：Mifflin-St Jeor（1990）</li>
              <li>1RM 估算：Epley（1985）、Brzycki（1993）</li>
              <li>FFMI：Kouri 等（1995）身高校正</li>
              <li>自適應 TDEE：平均攝取 − 體重變化斜率 × 7700 kcal/kg（每公斤體重變化約 7700 kcal 的近似值）</li>
            </ul>
          </div>
          <p className="text-sm text-chalk-3">動作庫說明文字為本 App 自行撰寫。</p>
        </div>
      </Section>
    </div>
  );
}
