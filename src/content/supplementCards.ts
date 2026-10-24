// 補給品知識卡（給重訓未滿一年、目標增肌的新手）。內容放在程式裡，不寫進 DB。
// 來源規範：
// - 每條功效、劑量、安全宣稱都要附 SOURCES 裡的來源；來源必須有 PMID 或 DOI，或是政府機關官方網址（kind='government'）。
// - 優先順序：ISSN 立場聲明 > IOC 共識聲明 > 系統性回顧／統合分析 > 隨機對照試驗；台灣數值以食藥署、國健署為準。
// - 劑量只寫來源裡實際出現的數字；不提品牌、商品名、通路，不做治療或預防疾病的宣稱。
// - 證據等級是「對增肌／阻力訓練」而言，不是一般健康。

export type EvidenceGrade = 'A' | 'B' | 'C' | 'D';

export const GRADE_INFO: Record<EvidenceGrade, { label: string; desc: string }> = {
  A: {
    label: '證據充分',
    desc: 'ISSN／IOC 等立場聲明與多項隨機對照試驗一致支持，對增肌或阻力訓練表現有效。',
  },
  B: {
    label: '有條件有效',
    desc: '有支持證據，但效果較小，或只在特定情境有用（例如用來補足飲食不足、特定訓練型態）。',
  },
  C: {
    label: '證據有限',
    desc: '證據有限或結果不一致；或只在缺乏時才有幫助。',
  },
  D: {
    label: '不建議',
    desc: '目前證據不支持對增肌有效，或有安全疑慮。',
  },
};

export interface SourceRef {
  /** 顯示用，例如「ISSN 立場聲明：肌酸（Kreider 2017）」 */
  label: string;
  kind: 'position' | 'consensus' | 'meta-analysis' | 'review' | 'rct' | 'government';
  pmid?: string;
  doi?: string;
  /** https://pubmed.ncbi.nlm.nih.gov/<pmid>/、https://doi.org/<doi> 或政府官方網址 */
  url: string;
  year: number;
}

export const SOURCES = {
  'issn-creatine-2017': {
    label: 'ISSN 立場聲明：肌酸（Kreider 2017）',
    kind: 'position',
    pmid: '28615996',
    doi: '10.1186/s12970-017-0173-z',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28615996/',
    year: 2017,
  },
  'creatine-myths-2021': {
    label: '肌酸常見問題與迷思回顧（Antonio 2021）',
    kind: 'review',
    pmid: '33557850',
    doi: '10.1186/s12970-021-00412-w',
    url: 'https://pubmed.ncbi.nlm.nih.gov/33557850/',
    year: 2021,
  },
  'issn-protein-2017': {
    label: 'ISSN 立場聲明：蛋白質與運動（Jäger 2017）',
    kind: 'position',
    pmid: '28642676',
    doi: '10.1186/s12970-017-0177-8',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28642676/',
    year: 2017,
  },
  'protein-meta-2018': {
    label: '蛋白質補充與阻力訓練統合分析（Morton 2018）',
    kind: 'meta-analysis',
    pmid: '28698222',
    doi: '10.1136/bjsports-2017-097608',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28698222/',
    year: 2018,
  },
  'issn-diets-2017': {
    label: 'ISSN 立場聲明：飲食與身體組成（Aragon 2017）',
    kind: 'position',
    pmid: '28630601',
    doi: '10.1186/s12970-017-0174-y',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28630601/',
    year: 2017,
  },
  'issn-caffeine-2021': {
    label: 'ISSN 立場聲明：咖啡因與運動表現（Guest 2021）',
    kind: 'position',
    pmid: '33388079',
    doi: '10.1186/s12970-020-00383-4',
    url: 'https://pubmed.ncbi.nlm.nih.gov/33388079/',
    year: 2021,
  },
  'issn-beta-alanine-2015': {
    label: 'ISSN 立場聲明：β-丙胺酸（Trexler 2015）',
    kind: 'position',
    pmid: '26175657',
    doi: '10.1186/s12970-015-0090-y',
    url: 'https://pubmed.ncbi.nlm.nih.gov/26175657/',
    year: 2015,
  },
  'issn-hmb-2013': {
    label: 'ISSN 立場聲明：HMB（Wilson 2013）',
    kind: 'position',
    pmid: '23374455',
    doi: '10.1186/1550-2783-10-6',
    url: 'https://pubmed.ncbi.nlm.nih.gov/23374455/',
    year: 2013,
  },
  'issn-review-2018': {
    label: 'ISSN 運動營養研究回顧與建議（Kerksick 2018）',
    kind: 'review',
    pmid: '30068354',
    doi: '10.1186/s12970-018-0242-y',
    url: 'https://pubmed.ncbi.nlm.nih.gov/30068354/',
    year: 2018,
  },
  'ioc-supplements-2018': {
    label: 'IOC 共識聲明：補給品與高水準運動員（Maughan 2018）',
    kind: 'consensus',
    pmid: '29540367',
    doi: '10.1136/bjsports-2018-099027',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29540367/',
    year: 2018,
  },
  'soy-meta-2018': {
    label: '大豆蛋白與動物蛋白統合分析（Messina 2018）',
    kind: 'meta-analysis',
    pmid: '29722584',
    doi: '10.1123/ijsnem.2018-0071',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29722584/',
    year: 2018,
  },
  'plant-animal-meta-2025': {
    label: '植物蛋白與動物蛋白統合分析（Reid-McCann 2025）',
    kind: 'meta-analysis',
    pmid: '39813010',
    doi: '10.1093/nutrit/nuae200',
    url: 'https://pubmed.ncbi.nlm.nih.gov/39813010/',
    year: 2025,
  },
  'vegan-rct-2021': {
    label: '全植物飲食與雜食的阻力訓練試驗（Hevia-Larraín 2021）',
    kind: 'rct',
    pmid: '33599941',
    doi: '10.1007/s40279-021-01434-9',
    url: 'https://pubmed.ncbi.nlm.nih.gov/33599941/',
    year: 2021,
  },
  'bcaa-review-2017': {
    label: 'BCAA 與肌肉蛋白合成回顧（Wolfe 2017）',
    kind: 'review',
    pmid: '28852372',
    doi: '10.1186/s12970-017-0184-9',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28852372/',
    year: 2017,
  },
  'glutamine-rct-2001': {
    label: '麩醯胺酸合併阻力訓練試驗（Candow 2001）',
    kind: 'rct',
    pmid: '11822473',
    doi: '10.1007/s00421-001-0523-y',
    url: 'https://pubmed.ncbi.nlm.nih.gov/11822473/',
    year: 2001,
  },
  'hmb-meta-2018': {
    label: 'HMB 對有訓練運動員的統合分析（Sanchez-Martinez 2018）',
    kind: 'meta-analysis',
    pmid: '29249685',
    doi: '10.1016/j.jsams.2017.11.003',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29249685/',
    year: 2018,
  },
  'hmb-meta-2009': {
    label: 'HMB 與阻力訓練統合分析（Rowlands 2009）',
    kind: 'meta-analysis',
    pmid: '19387395',
    doi: '10.1519/JSC.0b013e3181a00c80',
    url: 'https://pubmed.ncbi.nlm.nih.gov/19387395/',
    year: 2009,
  },
  'vitd-meta-2023': {
    label: '維生素 D 與運動員肌力統合分析（Sist 2023）',
    kind: 'meta-analysis',
    pmid: '37841405',
    doi: '10.3389/fnut.2023.1163313',
    url: 'https://pubmed.ncbi.nlm.nih.gov/37841405/',
    year: 2023,
  },
  'omega3-review-2020': {
    label: '魚油與年輕健康成人肌肉系統性回顧（Heileson 2020）',
    kind: 'review',
    pmid: '32483626',
    doi: '10.1093/nutrit/nuaa034',
    url: 'https://pubmed.ncbi.nlm.nih.gov/32483626/',
    year: 2020,
  },
  'omega3-mps-meta-2025': {
    label: 'Omega-3 與肌肉蛋白合成統合分析（Therdyothin 2025）',
    kind: 'meta-analysis',
    pmid: '38777807',
    doi: '10.1093/nutrit/nuae055',
    url: 'https://pubmed.ncbi.nlm.nih.gov/38777807/',
    year: 2025,
  },
  'daa-rct-2015': {
    label: 'D-天門冬胺酸 3 g 與 6 g 試驗（Melville 2015）',
    kind: 'rct',
    pmid: '25844073',
    doi: '10.1186/s12970-015-0078-7',
    url: 'https://pubmed.ncbi.nlm.nih.gov/25844073/',
    year: 2015,
  },
  'daa-rct-2017': {
    label: 'D-天門冬胺酸 12 週訓練試驗（Melville 2017）',
    kind: 'rct',
    pmid: '28841667',
    doi: '10.1371/journal.pone.0182630',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28841667/',
    year: 2017,
  },
  't-booster-review-2020': {
    label: '「睪固酮促進」產品成分與宣稱檢視（Clemesha 2020）',
    kind: 'review',
    pmid: '31385468',
    doi: '10.5534/wjmh.190043',
    url: 'https://pubmed.ncbi.nlm.nih.gov/31385468/',
    year: 2020,
  },
  'tribulus-review-2022': {
    label: '刺蒺藜與運動男性系統性回顧（Fernández-Lázaro 2022）',
    kind: 'review',
    pmid: '35954909',
    doi: '10.3390/ijerph19159533',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35954909/',
    year: 2022,
  },
  'tfda-caffeine-2016': {
    label: '食藥署《藥物食品安全週報》第 557 期：嗜飲咖啡別超量（2016）',
    kind: 'government',
    url: 'https://www.fda.gov.tw/TC/includes/GetFile.ashx?id=f636694211316223546',
    year: 2016,
  },
  'mohw-caffeine-2014': {
    label: '衛福部：選購認清咖啡因含量，保障你我健康（2014）',
    kind: 'government',
    url: 'https://www.mohw.gov.tw/cp-3204-21749-1.html',
    year: 2014,
  },
  'hpa-ul-2022': {
    label: '國健署：國人膳食營養素上限攝取量（UL，民國 111 年）',
    kind: 'government',
    url: 'https://data.gov.tw/dataset/8497',
    year: 2022,
  },
} as const satisfies Record<string, SourceRef>;

export type SourceId = keyof typeof SOURCES;

export interface Claim {
  text: string;
  sources: SourceId[];
}

export interface SupplementCard {
  id: string; // kebab-case，例如 'creatine'
  name: string; // 例如「肌酸」
  aka: string[]; // 別名與英文，例如 ['一水肌酸', 'creatine monohydrate']
  grade: EvidenceGrade;
  oneLiner: string; // 一句話結論，≤ 40 字
  whatItIs: string; // 是什麼，≤ 120 字
  forYou: string; // 對新手增肌的實際意義（要不要買、優先順序），≤ 150 字
  claims: Claim[]; // 功效相關宣稱（含「沒有效」的結論也算宣稱），至少 1 條
  dose: Claim[]; // 劑量與用法，具體數字＋單位，至少 1 條
  safety: Claim[]; // 安全與注意事項，至少 1 條
  skipIf: string[]; // 誰應先問醫師或避免
  /** 「我的產品」可對應的類別 */
  productCategory?: 'protein' | 'creatine' | 'caffeine' | 'other';
}

export const SUPPLEMENT_CARDS: SupplementCard[] = [
  {
    id: 'whey-protein',
    name: '乳清蛋白',
    aka: ['乳清', '濃縮乳清', '分離乳清', '高蛋白', 'whey protein', 'WPC', 'WPI'],
    grade: 'A',
    oneLiner: '三餐蛋白質吃不夠時最省事的補法；吃夠了就不必再加。',
    whatItIs:
      '牛奶製成起司時分離出的蛋白質，消化吸收快、白胺酸含量高。運動營養產品常用的濃縮乳清蛋白質約占 70–80%；超過 90% 的稱為分離乳清，乳糖與脂肪較少。',
    forYou:
      '先算每天總蛋白質：增肌約每公斤體重 1.4–2.0 g。三餐就吃得到的人不用買；吃不到時，乳清是最方便的補法。它只是「方便的食物」，增肌的主力仍是訓練與每日總攝取量。',
    claims: [
      {
        text: '統合分析（49 項試驗）：阻力訓練期間補充蛋白質可增加肌力與去脂體重，但平均只多約 0.3 kg 去脂體重；訓練本身才是主要刺激。',
        sources: ['protein-meta-2018'],
      },
      {
        text: '每日總蛋白質超過約 1.6 g/kg 後，再多補也不會讓去脂體重增加更多。',
        sources: ['protein-meta-2018'],
      },
      {
        text: '乳清消化快、白胺酸約占 11%，在補給品常用的蛋白質中刺激肌肉蛋白合成的效果較好。',
        sources: ['issn-protein-2017'],
      },
      {
        text: '原型食物也能吃到足夠蛋白質；補給品是兼顧品質與份量、又不必多吃太多熱量的實用方法。',
        sources: ['issn-protein-2017'],
      },
      {
        text: 'IOC：蛋白質是增重類補給品的核心成分，搭配阻力訓練能有效促進瘦體組織增加。',
        sources: ['ioc-supplements-2018'],
      },
    ],
    dose: [
      {
        text: '增肌的每日總蛋白質約 1.4–2.0 g/kg（含三餐），乳清只用來補不足的部分。',
        sources: ['issn-protein-2017'],
      },
      {
        text: '每次約 0.25 g/kg 或 20–40 g 優質蛋白質，含白胺酸 700–3000 mg；一天中每 3–4 小時平均分配。',
        sources: ['issn-protein-2017'],
      },
      {
        text: '訓練前或訓練後吃都有好處，依個人習慣即可；訓練帶來的合成效果至少持續 24 小時，但時間拉長會逐漸減弱。',
        sources: ['issn-protein-2017'],
      },
    ],
    safety: [
      {
        text: '沒有疾病的健康訓練者，研究中每天 2.5–3.3 g/kg、長達一年，未見血脂與肝腎指標受損。',
        sources: ['issn-protein-2017'],
      },
      {
        text: '已有腎衰竭的人需要限制蛋白質，不能套用健康者的研究結論。',
        sources: ['issn-protein-2017'],
      },
      {
        text: '蛋白粉可能添加沒有實證的其他成分，並提高污染風險；多數國家的補給品不需證明安全與品質。',
        sources: ['ioc-supplements-2018'],
      },
    ],
    skipIf: ['腎臟疾病，或醫師要求限制蛋白質', '對牛奶蛋白過敏', '孕哺或有慢性病正在服藥（先問醫師或營養師）'],
    productCategory: 'protein',
  },
  {
    id: 'casein',
    name: '酪蛋白',
    aka: ['膠束酪蛋白', '慢速蛋白', 'micellar casein', 'casein protein'],
    grade: 'B',
    oneLiner: '消化較慢的牛奶蛋白；睡前補一份是選項，不是必需品。',
    whatItIs:
      '牛奶中的另一種主要蛋白質。在胃裡會凝結，消化吸收比乳清慢；白胺酸約占 9.3%，略低於乳清的 11%。',
    forYou:
      '一天的總蛋白質吃夠，比挑哪種蛋白粉重要得多。若晚餐到睡前間隔很長、白天又補不夠，睡前一份酪蛋白是合理做法；預算有限時，買一種乳清就夠了。',
    claims: [
      {
        text: '睡前約 30 分鐘吃 30–40 g 酪蛋白，可提高夜間的肌肉蛋白合成。',
        sources: ['issn-protein-2017'],
      },
      {
        text: '一項 12 週訓練研究中，每晚睡前補充酪蛋白的組別肌肉量與肌力進步較多；但該組每日總蛋白質也較高（約 1.9 對 1.3 g/kg），無法分辨是時機還是總量的功勞。',
        sources: ['issn-protein-2017'],
      },
      {
        text: '總蛋白質相同時，早上或睡前吃酪蛋白，8 週後身體組成與表現沒有顯著差異。',
        sources: ['issn-protein-2017'],
      },
      {
        text: '同樣份量下，乳清比酪蛋白更能刺激訓練後的肌肉蛋白合成。',
        sources: ['issn-protein-2017'],
      },
      {
        text: '長期來看，補充蛋白質的時機與種類影響很小，每日總攝取量才是關鍵。',
        sources: ['protein-meta-2018'],
      },
    ],
    dose: [
      {
        text: '睡前約 30 分鐘吃 30–40 g。',
        sources: ['issn-protein-2017'],
      },
      {
        text: '算在每日總蛋白質 1.4–2.0 g/kg 之內，不是額外再加。',
        sources: ['issn-protein-2017'],
      },
    ],
    safety: [
      {
        text: '沒有疾病的健康訓練者，較高的蛋白質攝取未見肝腎傷害；已有腎衰竭者則需限制蛋白質。',
        sources: ['issn-protein-2017'],
      },
      {
        text: '蛋白粉可能添加沒有實證的其他成分，並提高污染風險。',
        sources: ['ioc-supplements-2018'],
      },
    ],
    skipIf: ['腎臟疾病，或醫師要求限制蛋白質', '對牛奶蛋白過敏'],
    productCategory: 'protein',
  },
  {
    id: 'plant-protein',
    name: '植物蛋白',
    aka: ['大豆蛋白', '豌豆蛋白', '米蛋白', '素食蛋白粉', 'soy protein', 'pea protein', 'plant protein'],
    grade: 'B',
    oneLiner: '吃素或不適合牛奶蛋白時的替代品；大豆蛋白效果接近乳清。',
    whatItIs:
      '從大豆、豌豆、米等植物萃取的蛋白粉。植物蛋白的必需胺基酸與白胺酸通常比乳製品蛋白少；大豆是其中研究最多的一種。',
    forYou:
      '吃素、乳糖不耐或對牛奶蛋白過敏的人可以選。優先選大豆蛋白，證據最多；其他植物蛋白研究較少，效果可能稍差。只要每日總蛋白質吃夠，來源對新手增肌的影響不大。',
    claims: [
      {
        text: '統合分析（9 項試驗）：阻力訓練時補充大豆蛋白，肌力與瘦體組織的進步和乳清等動物蛋白相近。',
        sources: ['soy-meta-2018'],
      },
      {
        text: '較新的統合分析：大豆與牛奶蛋白對肌肉量沒有差異；米、燕麥、馬鈴薯等非大豆植物蛋白可能略遜於動物蛋白；兩者對肌力沒有差異。',
        sources: ['plant-animal-meta-2025'],
      },
      {
        text: '未受訓的年輕男性每日蛋白質約 1.6 g/kg 時，全植物飲食（加大豆分離蛋白）與雜食（加乳清）訓練 12 週，肌肉量與肌力進步沒有差異。',
        sources: ['vegan-rct-2021'],
      },
      {
        text: '植物蛋白常缺少一種以上的必需胺基酸；大豆雖是完全蛋白，支鏈胺基酸仍比牛奶蛋白少。',
        sources: ['issn-protein-2017'],
      },
    ],
    dose: [
      {
        text: '把每日總蛋白質補到約 1.6 g/kg（上述 12 週試驗的設計）。',
        sources: ['vegan-rct-2021'],
      },
      {
        text: '每次以 20–40 g 為基準，並以含白胺酸 700–3000 mg 為目標；植物蛋白白胺酸比例較低，這點更要留意。',
        sources: ['issn-protein-2017'],
      },
    ],
    safety: [
      {
        text: '沒有疾病的健康訓練者，較高的蛋白質攝取未見肝腎傷害；已有腎衰竭者則需限制蛋白質。',
        sources: ['issn-protein-2017'],
      },
      {
        text: '蛋白粉可能添加沒有實證的其他成分，並提高污染風險。',
        sources: ['ioc-supplements-2018'],
      },
    ],
    skipIf: ['腎臟疾病，或醫師要求限制蛋白質', '對大豆、豌豆等原料過敏'],
    productCategory: 'protein',
  },
  {
    id: 'creatine',
    name: '肌酸',
    aka: ['一水肌酸', '肌酸單水合物', 'creatine monohydrate', 'creatine'],
    grade: 'A',
    oneLiner: '研究最多、最確定有效的增肌補給品，每天 3–5 g 就夠。',
    whatItIs:
      '肌肉裡用來快速供應能量的物質，肉類也含有。補充可提高肌肉內的肌酸存量，讓短時間、高強度的動作能多做幾下。研究最多的形式是一水肌酸。',
    forYou:
      '蛋白質吃夠之後，如果只買一種補給品，肌酸最值得。效果來自每組多做一兩下、累積更多訓練量，不是吃了就長肌肉。選一水肌酸，每天固定吃。',
    claims: [
      {
        text: 'ISSN：一水肌酸是目前提升高強度運動能力、增加訓練期間瘦體組織最有效的營養補給品。',
        sources: ['issn-creatine-2017'],
      },
      {
        text: '效果來自讓每組、每趟能多做一些，提高訓練品質，進而增加肌力與肌肉量。',
        sources: ['issn-creatine-2017'],
      },
      {
        text: 'IOC：配合阻力或間歇訓練長期使用，可帶來更多瘦體組織、肌力與爆發力。',
        sources: ['ioc-supplements-2018'],
      },
      {
        text: '一水肌酸是研究最多、效果最確定的形式；其他形式雖可能較易溶於水，實證仍以一水肌酸最佳。',
        sources: ['issn-creatine-2017', 'creatine-myths-2021'],
      },
    ],
    dose: [
      {
        text: '快速法（負荷期）：每天約 0.3 g/kg（約 20 g，分 4 次、每次 5 g），連續 5–7 天，之後每天 3–5 g 維持。',
        sources: ['issn-creatine-2017', 'ioc-supplements-2018'],
      },
      {
        text: '不負荷也可以：每天 3–5 g，約 3–4 週後肌肉存量達到相近水準。',
        sources: ['issn-creatine-2017', 'creatine-myths-2021'],
      },
      {
        text: '體型較大的人，維持期可能需要每天 5–10 g。',
        sources: ['issn-creatine-2017'],
      },
      {
        text: '和含碳水化合物或蛋白質的餐點一起吃，肌肉吸收較多，但表現上不一定更好。',
        sources: ['issn-creatine-2017'],
      },
      {
        text: '肌酸粉末很穩定，但溶在液體裡會慢慢分解（溫度高、偏酸時更快），泡好就喝。',
        sources: ['creatine-myths-2021'],
      },
    ],
    safety: [
      {
        text: '唯一一致被報告的副作用是體重增加；負荷期後可能增加 1–2 kg，主要是水分。',
        sources: ['issn-creatine-2017', 'ioc-supplements-2018'],
      },
      {
        text: '健康者照建議劑量使用，不會造成腎臟損傷，也沒有增加抽筋、脫水或肌肉受傷。',
        sources: ['creatine-myths-2021', 'issn-creatine-2017'],
      },
      {
        text: '服用肌酸可能讓血液肌酸酐上升，影響腎功能（eGFR）的判讀；抽血檢查時請告知醫師。',
        sources: ['creatine-myths-2021'],
      },
      {
        text: '少數腎功能異常的病例報告，多半合併原有腎臟病、服藥、其他補給品或劑量過高。',
        sources: ['creatine-myths-2021'],
      },
      {
        text: '研究中健康者每天最多 30 g、長達 5 年，未見不良影響。',
        sources: ['issn-creatine-2017'],
      },
    ],
    skipIf: ['已有腎臟疾病或腎功能異常', '正在服用影響腎臟的藥物', '孕哺', '未滿 18 歲（先與家長及醫師討論）'],
    productCategory: 'creatine',
  },
  {
    id: 'caffeine',
    name: '咖啡因',
    aka: ['咖啡', '無水咖啡因', '訓練前飲', 'caffeine', 'pre-workout'],
    grade: 'B',
    oneLiner: '練前提神、小幅提升力量與耐力；一杯咖啡就有，不必另買。',
    whatItIs:
      '咖啡、茶、能量飲料裡的興奮劑，也是訓練前飲品的主要成分。能降低疲勞感與用力感；效果因人而異，和基因及平常的攝取習慣有關。',
    forYou:
      '不是增肌必需品，只是讓單次訓練表現好一點。習慣喝咖啡的人，練前一杯就有類似效果。把當天所有咖啡、茶、飲料加總，不超過 300 mg；傍晚後別喝，以免失眠。',
    claims: [
      {
        text: 'ISSN：咖啡因對肌耐力、動作速度與肌力有小到中等的提升，但並非每個研究都有效。',
        sources: ['issn-caffeine-2021'],
      },
      {
        text: '在肌力與肌耐力方面，研究結果仍有不確定性：有的有效、有的無效，甚至有肌耐力變差的報告。',
        sources: ['issn-caffeine-2021'],
      },
      {
        text: 'IOC 將咖啡因列為少數有良好證據可提升運動表現的補給品之一。',
        sources: ['ioc-supplements-2018'],
      },
      {
        text: '受過訓練與未受訓的人都觀察到效果。',
        sources: ['issn-caffeine-2021'],
      },
    ],
    dose: [
      {
        text: '研究常用每公斤體重 3–6 mg，最常見在訓練前約 60 分鐘攝取；最低有效劑量可能低至 2 mg/kg。',
        sources: ['issn-caffeine-2021', 'ioc-supplements-2018'],
      },
      {
        text: '食藥署建議每天咖啡因總攝取量不超過 300 mg。以 70 kg 計，3 mg/kg 約 210 mg，要一起算進當天的咖啡、茶與飲料。',
        sources: ['tfda-caffeine-2016'],
      },
      {
        text: '更高劑量（約 9 mg/kg 以上）不會更有效，副作用卻明顯增加。',
        sources: ['issn-caffeine-2021', 'ioc-supplements-2018'],
      },
    ],
    safety: [
      {
        text: '常見副作用：心跳加快、心悸、焦慮、頭痛、失眠與睡眠品質變差。',
        sources: ['issn-caffeine-2021', 'tfda-caffeine-2016'],
      },
      {
        text: '咖啡因半衰期約 4–6 小時；傍晚攝取較容易失眠。',
        sources: ['issn-caffeine-2021'],
      },
      {
        text: '長期飲用可能產生心理依賴，停用時可能出現戒斷症狀。',
        sources: ['tfda-caffeine-2016'],
      },
      {
        text: '純咖啡因粉末很容易算錯劑量，曾有研究因計算錯誤給到極高劑量而造成嚴重不良反應；不要自行秤粉末。',
        sources: ['ioc-supplements-2018'],
      },
      {
        text: '有心血管疾病、心律不整、腸胃病、長期失眠者，以及孕婦與孩童，最好避免或減少含咖啡因飲品。',
        sources: ['mohw-caffeine-2014'],
      },
    ],
    skipIf: ['懷孕或哺乳', '心血管疾病、心律不整或高血壓', '腸胃病', '長期失眠或焦慮', '未滿 18 歲', '正在服藥（先問藥師是否有交互作用）'],
    productCategory: 'caffeine',
  },
  {
    id: 'beta-alanine',
    name: 'β-丙胺酸',
    aka: ['乙型丙胺酸', 'beta-alanine', 'β-alanine'],
    grade: 'C',
    oneLiner: '對 1–4 分鐘的高強度運動有幫助，對增肌與肌力的效果不明確。',
    whatItIs:
      '一種胺基酸，是肌肉中緩衝酸性物質的「肌肽」原料。每天補充數週可提高肌肽濃度，延緩高強度運動的疲勞。吃了皮膚會刺刺麻麻，屬常見現象。',
    forYou:
      '對重訓新手增肌不是優先選項。若你常做 1–4 分鐘的高強度間歇或循環訓練，才比較可能有感。預算有限時，先把蛋白質與肌酸顧好。',
    claims: [
      {
        text: '每天 4–6 g、至少 2–4 週，可改善運動表現，以 1–4 分鐘的高強度項目最明顯。',
        sources: ['issn-beta-alanine-2015'],
      },
      {
        text: '用在阻力訓練時，可能增加訓練量、降低疲勞感，但目前沒有證據顯示能額外增加肌力。',
        sources: ['issn-beta-alanine-2015'],
      },
      {
        text: 'IOC：對 30 秒到 10 分鐘的運動約有 0.2–3% 的小幅提升，訓練有素者較難見效。',
        sources: ['ioc-supplements-2018'],
      },
    ],
    dose: [
      {
        text: '每天 4–6 g，至少 4 週可提高肌肽；分成每次 1.6 g 左右的小劑量可減輕刺麻感。',
        sources: ['issn-beta-alanine-2015'],
      },
      {
        text: 'IOC 列出的用法：每天約 65 mg/kg，每 3–4 小時吃 0.8–1.6 g，持續 10–12 週。',
        sources: ['ioc-supplements-2018'],
      },
    ],
    safety: [
      {
        text: '常見副作用是皮膚刺麻感，通常 60–90 分鐘內消失，目前沒有證據顯示有害；分次小劑量或緩釋劑型可減輕。',
        sources: ['issn-beta-alanine-2015'],
      },
      {
        text: '目前沒有超過 1 年的長期使用安全性資料。',
        sources: ['issn-beta-alanine-2015'],
      },
      {
        text: '可能出現皮膚疹。',
        sources: ['ioc-supplements-2018'],
      },
    ],
    skipIf: ['孕哺', '有慢性病或正在服藥（先問醫師）'],
    productCategory: 'other',
  },
  {
    id: 'weight-gainer',
    name: '增重粉',
    aka: ['高熱量蛋白粉', '增肌粉', '液體代餐', 'mass gainer', 'weight gainer'],
    grade: 'B',
    oneLiner: '本質是「液體熱量」，只適合三餐吃不夠、體重長不上去的人。',
    whatItIs:
      '以碳水化合物為主、加上蛋白質的高熱量粉末，IOC 歸在「液體代餐」：每毫升約 1–1.5 kcal，蛋白質占 15–20%、碳水 50–70%。沒有特殊增肌成分，作用是讓你更容易吃到熱量盈餘。',
    forYou:
      '增肌需要每天吃得比消耗多。若你偏瘦、食量小、體重好幾週都不動，可以用它補熱量；用牛奶、香蕉、燕麥自己打也有一樣的作用。體重已經穩定上升的人不需要。',
    claims: [
      {
        text: 'ISSN：以增加瘦體組織為主的飲食，需要持續的熱量盈餘來支持合成作用與越來越大的訓練量。',
        sources: ['issn-diets-2017'],
      },
      {
        text: '未受訓者每天多喝約 2010 kcal 的補充飲、訓練 8 週，瘦體組織增加約 3 kg；熱量相同但幾乎只有碳水的飲品效果相近，顯示關鍵是熱量而非特殊配方。',
        sources: ['issn-diets-2017'],
      },
      {
        text: 'IOC：液體代餐可用來補充高熱量飲食（例如增重期）或當作方便攜帶的營養，但通常比一般食物貴。',
        sources: ['ioc-supplements-2018'],
      },
      {
        text: 'IOC：蛋白質是增重補給品的核心成分，要搭配阻力訓練才能有效增加瘦體組織。',
        sources: ['ioc-supplements-2018'],
      },
    ],
    dose: [
      {
        text: '沒有固定劑量，用來補足每日熱量缺口；研究中的熱量盈餘從每天約 +544 kcal 到 +2010 kcal 都有。',
        sources: ['issn-diets-2017'],
      },
      {
        text: 'ISSN：未受訓者較適合較大的熱量盈餘，進階者適合較小的盈餘以免脂肪增加過多；仍需依個人反應調整。',
        sources: ['issn-diets-2017'],
      },
      {
        text: '同時讓每日總蛋白質達到約 1.4–2.0 g/kg。',
        sources: ['issn-protein-2017'],
      },
    ],
    safety: [
      {
        text: '熱量盈餘也會增加脂肪：菁英運動員每天多吃約 544 kcal、12 週後脂肪增加約 1.1 kg（對照組 0.2 kg）。',
        sources: ['issn-diets-2017'],
      },
      {
        text: '有些人多吃之後日常活動量會不自覺增加，抵銷部分盈餘；要看體重的實際變化來調整份量。',
        sources: ['issn-diets-2017'],
      },
      {
        text: '補給品不需事先證明效果、安全或品質，成分越複雜的產品越要留意標示與污染風險。',
        sources: ['ioc-supplements-2018'],
      },
    ],
    skipIf: ['糖尿病或血糖控制不佳（多半含大量碳水）', '腎臟疾病，或醫師要求限制蛋白質', '體脂已偏高、目前目標是先減脂'],
    productCategory: 'protein',
  },
  {
    id: 'vitamin-d',
    name: '維生素 D',
    aka: ['維他命 D', '維生素 D3', 'vitamin D', 'D3', 'cholecalciferol'],
    grade: 'C',
    oneLiner: '缺乏時才需要補；濃度正常的人多補，對增肌沒有明顯幫助。',
    whatItIs:
      '脂溶性維生素，人體約九成的來源是皮膚曬太陽合成。和骨骼、免疫與肌肉功能有關；缺乏時會影響訓練與骨骼健康。',
    forYou:
      '很少曬太陽、整天待在室內的人，可請醫師抽血驗 25(OH)D 再決定。驗出不足再補，才可能對訓練有幫助；不要為了增肌自行吃高劑量。',
    claims: [
      {
        text: 'IOC：補充維生素 D 對肌肉功能與恢復的研究結果不一致，差異多半取決於補充前的濃度。',
        sources: ['ioc-supplements-2018'],
      },
      {
        text: '運動員統合分析（11 項隨機對照試驗）：補充維生素 D 對最大肌力與爆發力沒有統計上顯著的效果。',
        sources: ['vitd-meta-2023'],
      },
      {
        text: '維生素 D 不足和較高的壓力性骨折風險有關，必要時補充可能降低風險。',
        sources: ['ioc-supplements-2018'],
      },
      {
        text: '補充劑量應依抽血測得的基準濃度決定。',
        sources: ['issn-review-2018'],
      },
    ],
    dose: [
      {
        text: 'IOC：一般人每天補充 800 IU 至 1000–2000 IU 可維持濃度；運動員目前沒有專屬建議。',
        sources: ['ioc-supplements-2018'],
      },
      {
        text: '已確定缺乏時的短期高劑量補充，需由醫療人員監測。',
        sources: ['ioc-supplements-2018'],
      },
      {
        text: '國健署上限攝取量（UL）：成人（19 歲以上）每天 50 μg（約 2000 IU）。',
        sources: ['hpa-ul-2022'],
      },
    ],
    safety: [
      {
        text: '脂溶性維生素會在體內累積，過量可能中毒。',
        sources: ['issn-review-2018'],
      },
      {
        text: '高劑量補充時需小心監測，以免中毒。',
        sources: ['ioc-supplements-2018'],
      },
      {
        text: '飲食與所有補充品加總，長期每天不要超過 50 μg。',
        sources: ['hpa-ul-2022'],
      },
    ],
    skipIf: ['腎臟疾病、腎結石或血鈣過高', '副甲狀腺疾病', '正在服用處方藥（先問醫師或藥師）', '孕哺（劑量先問醫師）'],
    productCategory: 'other',
  },
  {
    id: 'fish-oil',
    name: '魚油（Omega-3）',
    aka: ['魚油', 'Omega-3', 'EPA', 'DHA', 'fish oil'],
    grade: 'C',
    oneLiner: '對增肌效果不明確；IOC 建議優先從多脂魚吃到，而不是吃補充品。',
    whatItIs:
      '從魚類萃取的長鏈 omega-3 脂肪酸，主要是 EPA 與 DHA。常被宣稱能抗發炎、幫助恢復與增肌，但在年輕健康者身上的證據有限。',
    forYou:
      '不是增肌補給品。平常幾乎不吃魚的人，先試著把鮭魚、鯖魚、秋刀魚等放進菜單。若仍想吃魚油，那是一般健康的考量，不是為了增肌；服用抗凝血藥物者要先問醫師。',
    claims: [
      {
        text: 'IOC：omega-3 可能增加肌肉蛋白合成，但訓練後吃到足量蛋白質時，這個效果可能不會出現。',
        sources: ['ioc-supplements-2018'],
      },
      {
        text: '統合分析：補充 omega-3 對肌肉蛋白合成速率沒有顯著影響。',
        sources: ['omega3-mps-meta-2025'],
      },
      {
        text: '年輕健康成人的系統性回顧：魚油可能有助於從訓練壓力中恢復，但對增加瘦體組織或肌力的角色仍不明確。',
        sources: ['omega3-review-2020'],
      },
      {
        text: '減輕延遲性肌肉痠痛的效果並不一致。',
        sources: ['ioc-supplements-2018'],
      },
    ],
    dose: [
      {
        text: 'IOC 表列的用量約每天 2 g；但 IOC 認為最好的建議可能是在飲食中加入多脂魚，而不是吃補充品。',
        sources: ['ioc-supplements-2018'],
      },
    ],
    safety: [
      {
        text: '高劑量補充品可能有不良反應：可能含重金屬污染，也可能造成出血、腸胃不適或低密度脂蛋白膽固醇上升。',
        sources: ['ioc-supplements-2018'],
      },
    ],
    skipIf: ['正在服用抗凝血或抗血小板藥物', '近期要手術或拔牙', '有出血性疾病', '對魚類過敏', '孕哺（先問醫師）'],
    productCategory: 'other',
  },
  {
    id: 'multivitamin',
    name: '綜合維他命',
    aka: ['綜合維生素', '多種維生素', '複方維他命', 'multivitamin'],
    grade: 'C',
    oneLiner: '飲食均衡時沒有增肌效果；吃得少或偏食時可當保險，但別超量。',
    whatItIs:
      '把多種維生素與礦物質做成一錠的補給品。維生素不提供熱量，也不會直接讓肌肉變大；只有在缺乏時，補足才可能改善健康與表現。',
    forYou:
      '先把三餐吃夠、蔬果與蛋白質吃齊。正在控制熱量、挑食或飲食明顯不均時，低劑量的綜合維他命可以當保險；不要同時吃好幾種含相同成分的產品。',
    claims: [
      {
        text: '平常吃得均衡、營養密度足夠的人，多數維生素沒有提升運動表現的效果。',
        sources: ['issn-review-2018'],
      },
      {
        text: '每天補充維生素與礦物質，目前未發現能提升運動能力。',
        sources: ['issn-review-2018'],
      },
      {
        text: '若確實缺乏某種維生素，補充或改善飲食可以改善健康與表現。',
        sources: ['issn-review-2018'],
      },
      {
        text: 'IOC：不建議無差別地補充微量營養素，應先經營養評估確認缺乏。',
        sources: ['ioc-supplements-2018'],
      },
      {
        text: '運動員常吃不夠熱量，因此許多運動營養師建議在訓練量大時吃低劑量綜合維他命。',
        sources: ['issn-review-2018'],
      },
    ],
    dose: [
      {
        text: '選低劑量的產品，並把飲食與所有補充品加總，不超過國健署 19 歲以上上限：維生素 A 3000 μg RE、維生素 D 50 μg、維生素 B6 80 mg、鐵 40 mg、鋅 35 mg。',
        sources: ['hpa-ul-2022', 'issn-review-2018'],
      },
    ],
    safety: [
      {
        text: '維生素 A、D、E、K 是脂溶性，會在體內累積，過量可能中毒；維生素 B6 過量可能造成周邊神經損傷。',
        sources: ['issn-review-2018'],
      },
      {
        text: '高劑量維生素 C 與 E 可能削弱訓練帶來的適應。',
        sources: ['issn-review-2018'],
      },
      {
        text: '鐵質足夠的人再補高劑量鐵，可能引起嘔吐、腹瀉、腹痛，嚴重時導致鐵質沉積與肝衰竭。',
        sources: ['ioc-supplements-2018'],
      },
      {
        text: '少數綜合維他命也曾被驗出未標示的禁用成分。',
        sources: ['ioc-supplements-2018'],
      },
    ],
    skipIf: ['孕哺或準備懷孕（成分與劑量先問醫師）', '正在服用處方藥', '腎臟或肝臟疾病', '已在吃其他含鐵、維生素 A 或 D 的補充品'],
    productCategory: 'other',
  },
  {
    id: 'bcaa-eaa',
    name: 'BCAA／EAA',
    aka: ['支鏈胺基酸', '必需胺基酸', '白胺酸', 'BCAA', 'EAA', 'leucine'],
    grade: 'C',
    oneLiner: '蛋白質吃夠就不必買；單喝 BCAA 撐不起肌肉合成。',
    whatItIs:
      'BCAA 是白胺酸、異白胺酸、纈胺酸三種支鏈胺基酸；EAA 是人體無法自行合成的 9 種必需胺基酸，BCAA 也在其中。乳清、肉、蛋、豆等完整蛋白質本來就含有這些胺基酸。',
    forYou:
      '新手增肌不需要。把買 BCAA／EAA 的錢拿去買乳清，或多吃一份肉、蛋、奶、豆製品，證據更充分。',
    claims: [
      {
        text: '合成肌肉蛋白需要全部必需胺基酸；單吃 BCAA 無法支持肌肉蛋白合成增加，少數人體研究反而觀察到合成下降。',
        sources: ['bcaa-review-2017'],
      },
      {
        text: '運動後單吃約 5.6 g BCAA，肌肉蛋白合成比安慰劑多約兩成，但只有含相同 BCAA 量的乳清的一半左右。',
        sources: ['issn-review-2018'],
      },
      {
        text: 'BCAA 對增肌的長期研究結果不一：一項 8 週阻力訓練研究中，每天 9 g 並未改善身體組成或表現。',
        sources: ['issn-review-2018'],
      },
      {
        text: '6–12 g EAA 可刺激肌肉蛋白合成，但游離胺基酸形式的 EAA 能增加去脂體重的證據有限；長者研究中，同量 EAA 以完整蛋白質提供時，肌肉蛋白增加更多。',
        sources: ['issn-review-2018'],
      },
      {
        text: '刺激肌肉合成靠的是必需胺基酸；建議以含有全部必需胺基酸的原型食物為主。',
        sources: ['issn-protein-2017'],
      },
    ],
    dose: [
      {
        text: '每日總蛋白質達 1.4–2.0 g/kg、每餐 20–40 g 優質蛋白質（含白胺酸 700–3000 mg）時，研究顯示再多補也沒有額外增肌效果，不需另外補 BCAA／EAA。',
        sources: ['issn-protein-2017', 'protein-meta-2018'],
      },
      {
        text: '研究中刺激肌肉蛋白合成的 EAA 用量為每次 6–12 g。',
        sources: ['issn-review-2018'],
      },
    ],
    safety: [
      {
        text: '多數國家的補給品不需事先證明效果、安全或品質；也曾發生產品被驗出未標示的禁用成分。',
        sources: ['ioc-supplements-2018'],
      },
    ],
    skipIf: ['腎臟或肝臟疾病', '胺基酸代謝相關疾病', '孕哺'],
    productCategory: 'other',
  },
  {
    id: 'glutamine',
    name: '麩醯胺酸',
    aka: ['L-麩醯胺酸', 'glutamine', 'L-glutamine'],
    grade: 'D',
    oneLiner: '對增肌與力量沒有效果，是可以省下來的錢。',
    whatItIs:
      '體內含量最多的非必需胺基酸，身體可以自行合成，一般飲食的蛋白質裡也有。常被宣稱能幫助增肌、恢復與提升免疫力。',
    forYou:
      '不建議為了增肌購買。隨機對照試驗中，年輕人訓練 6 週、同時吃高劑量麩醯胺酸，肌力與肌肉量的進步和安慰劑一樣。',
    claims: [
      {
        text: '隨機對照試驗：年輕人 6 週阻力訓練期間每天吃 0.9 g/kg 瘦體重的麩醯胺酸，肌力、瘦體組織與肌肉分解指標都和安慰劑沒有差異。',
        sources: ['glutamine-rct-2001'],
      },
      {
        text: 'ISSN：沒有科學證據支持麩醯胺酸能增加瘦體組織或肌肉表現；高劑量（0.3 g/kg）也沒有增加腿推、臥推次數。',
        sources: ['issn-review-2018'],
      },
      {
        text: 'IOC：用來支持免疫的證據也有限，運動前後補充並未改變免疫指標的變化。',
        sources: ['ioc-supplements-2018'],
      },
    ],
    dose: [
      {
        text: '不建議花錢，故不提供劑量：ISSN 將其歸在增肌「幾乎沒有證據」的類別，隨機對照試驗也看不到效果。',
        sources: ['issn-review-2018', 'glutamine-rct-2001'],
      },
    ],
    safety: [
      {
        text: 'ISSN 將其列在「效果和／或安全性幾乎沒有證據支持」的類別。',
        sources: ['issn-review-2018'],
      },
      {
        text: '多數國家的補給品不需事先證明效果、安全或品質。',
        sources: ['ioc-supplements-2018'],
      },
    ],
    skipIf: ['肝臟或腎臟疾病', '孕哺', '有慢性病正在服藥（先問醫師）'],
    productCategory: 'other',
  },
  {
    id: 'hmb',
    name: 'HMB',
    aka: ['β-羥基-β-甲基丁酸', 'HMB-Ca', 'HMB-FA', 'beta-hydroxy-beta-methylbutyrate'],
    grade: 'C',
    oneLiner: '對有訓練經驗者幾乎無效，新手頂多小幅幫助，不如吃夠蛋白質。',
    whatItIs:
      '白胺酸在體內代謝產生的物質，被認為能減少肌肉分解。市售有鈣鹽（HMB-Ca）與游離酸（HMB-FA）兩種形式。',
    forYou:
      '不是優先選項。研究結論分歧：ISSN 立場聲明認為有效，但統合分析在有訓練者身上看不到效果；IOC 也認為從一般蛋白質就能得到類似好處。預算有限就跳過。',
    claims: [
      {
        text: 'ISSN（2013）：每天 38 mg/kg 配合適當訓練，可增加有訓練與未受訓者的肌肉肥大、肌力與爆發力。',
        sources: ['issn-hmb-2013'],
      },
      {
        text: '統合分析（6 項隨機對照試驗）：在有訓練的運動員身上，HMB 對肌力與身體組成沒有效果。',
        sources: ['hmb-meta-2018'],
      },
      {
        text: '統合分析：未受訓者的下肢肌力有小幅進步，有訓練者的效果微不足道；對身體組成的影響不明顯。',
        sources: ['hmb-meta-2009'],
      },
      {
        text: 'IOC：HMB 對肌力與去脂體重的效果很小，「類固醇級」的增肌報告未被重現；好處很可能從一般蛋白質就能得到。',
        sources: ['ioc-supplements-2018'],
      },
    ],
    dose: [
      {
        text: '研究用法：每天 3 g（約 38 mg/kg），分 3 次吃；在新訓練期開始前至少 2 週開始。',
        sources: ['issn-hmb-2013'],
      },
      {
        text: 'HMB-Ca 在訓練前至少 60 分鐘吃 3 g；HMB-FA 可在訓練前 30–60 分鐘。',
        sources: ['issn-hmb-2013'],
      },
    ],
    safety: [
      {
        text: 'ISSN：年輕人與年長者長期使用都安全；每天 6 g、一個月，未影響膽固醇、血球與肝腎功能。',
        sources: ['issn-hmb-2013'],
      },
    ],
    skipIf: ['孕哺', '腎臟或肝臟疾病', '正在服藥（先問醫師）'],
    productCategory: 'other',
  },
  {
    id: 'testosterone-boosters',
    name: '睪固酮促進劑',
    aka: ['刺蒺藜', '蒺藜', 'D-天門冬胺酸', 'DAA', 'Tribulus terrestris', 'D-aspartic acid', 'test booster'],
    grade: 'D',
    oneLiner: '宣稱提升睪固酮、加速增肌，研究不支持，還有摻禁藥的風險。',
    whatItIs:
      '標榜「天然提升睪固酮」的複方產品，常見成分有刺蒺藜、D-天門冬胺酸、鋅、鎂與多種維生素；一項調查中平均每款含 8 種以上成分。',
    forYou:
      '不要買。這類成分在阻力訓練研究中沒有增加肌肉或力量。標榜效果特別強的產品，反而要擔心摻了未標示的類固醇；需要接受禁藥檢測的選手更要避開。',
    claims: [
      {
        text: '刺蒺藜單獨使用或與其他成分合用，在阻力訓練研究中對身體組成與肌力都沒有效果。',
        sources: ['issn-review-2018'],
      },
      {
        text: '有訓練經驗的男性每天吃 6 g D-天門冬胺酸、訓練 12 週，睪固酮沒有改變，肌力與肌肥大的進步和安慰劑相同。',
        sources: ['daa-rct-2017'],
      },
      {
        text: '有訓練經驗的男性每天吃 6 g D-天門冬胺酸 2 週，總睪固酮與游離睪固酮反而下降。',
        sources: ['daa-rct-2015'],
      },
      {
        text: '檢視 50 款「睪固酮促進」產品：只有約 25% 的成分有研究顯示能提升睪固酮，約 10% 有降低睪固酮的資料，約 6 成查無相關研究。',
        sources: ['t-booster-review-2020'],
      },
      {
        text: '刺蒺藜的系統性回顧：對荷爾蒙與肌肉損傷指標沒有明確益處。',
        sources: ['tribulus-review-2022'],
      },
    ],
    dose: [
      {
        text: '不建議花錢，故不提供劑量：ISSN 不建議用 D-天門冬胺酸改善肌肉，刺蒺藜也歸在幾乎沒有證據的類別。',
        sources: ['issn-review-2018'],
      },
    ],
    safety: [
      {
        text: '健身類補給品曾被驗出未標示的類固醇，有的劑量甚至高於藥物治療劑量，可能傷肝並造成其他嚴重副作用。',
        sources: ['ioc-supplements-2018'],
      },
      {
        text: '早期一項研究分析全球 600 多款補給品，約 15% 含未標示的類固醇前驅物；極微量污染也可能讓禁藥檢測呈陽性。',
        sources: ['ioc-supplements-2018'],
      },
      {
        text: '部分產品的鋅、菸鹼素（維生素 B3）或鎂超過美國的上限攝取量。',
        sources: ['t-booster-review-2020'],
      },
      {
        text: '一項病例對照研究觀察到，使用健身類補給品與睪丸生殖細胞癌風險較高有關（勝算比 1.65）；這是關聯，尚未證實因果。',
        sources: ['ioc-supplements-2018'],
      },
    ],
    skipIf: ['未滿 18 歲', '正在服用任何處方藥', '有肝臟、攝護腺或心血管疾病', '需要接受運動禁藥檢測的選手'],
    productCategory: 'other',
  },
];

export const SUPPLEMENT_DISCLAIMER =
  '本頁內容整理自國際運動營養學會（ISSN）立場聲明、國際奧會（IOC）共識聲明、系統性回顧與台灣政府資料，僅供一般衛教參考，不是醫療建議，也不能取代醫師、藥師或營養師的個別評估。證據等級只針對增肌與阻力訓練表現，不代表對一般健康的效果。多數國家的補給品比照食品管理，不需事先證明效果與安全，實際成分可能與標示不符。有疾病、懷孕或哺乳、未滿 18 歲或正在服藥者，使用前請先諮詢醫療專業人員。';
