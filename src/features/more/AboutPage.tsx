import { PageHeader, Section } from '../../ui/Layout';

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title="關於與資料來源" back="/more" />

      <Section title="隱私">
        <div className="card flex flex-col gap-2 p-4 text-base text-chalk-2">
          <p>你的訓練、飲食與身體數據只存在這個瀏覽器的 IndexedDB，不會上傳到任何伺服器。</p>
          <p>App 程式碼放在 GitHub Pages，與同一個 github.io 網域下的其他頁面共用來源；本 App 的資料庫名稱獨立，不會與其他頁面混用。</p>
        </div>
      </Section>

      <Section title="免責聲明">
        <div className="card flex flex-col gap-2 p-4 text-base text-chalk-2">
          <p>熱量、巨量營養素、1RM 與加重建議皆依公開公式估算，僅供參考，不構成醫療、營養或運動處方建議。</p>
          <p>有傷病、慢性病、懷孕或特殊飲食需求，請先諮詢醫師或合格專業人員。訓練時請注意動作安全，必要時找人協助保護。</p>
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
            </ul>
          </div>
          <p className="text-sm text-chalk-3">動作庫說明文字為本 App 自行撰寫。</p>
        </div>
      </Section>
    </div>
  );
}
