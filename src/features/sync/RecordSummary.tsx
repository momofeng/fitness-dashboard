import { observationText } from '../../core/training/logging';
import { fmt } from '../../core/units';
import type { SyncRow } from '../../core/syncMerge';
const LABEL: Record<string, string> = {
  date: '日期', name: '名稱', nameZh: '動作', dayName: '訓練日', type: '類型', notes: '備註', note: '備註', norm: '辨識名稱',
  weightKg: '重量（kg）', reps: '次數', rir: '保留次數 RIR', minutes: '分鐘', distanceKm: '距離（km）', speedKmh: '速度（km/h）', inclinePct: '坡度（%）', resistance: '阻力',
  bodyFatPct: '體脂（%）', kcal: '熱量（kcal）', protein: '蛋白質（g）', carbs: '碳水（g）', fat: '脂肪（g）', qty: '份量', unit: '單位',
  workingWeightKg: '下次重量（kg）', nextTargetReps: '下次目標次數', lastMessage: '調整提醒', consecutiveFails: '連續未達標', deloadCount: '減量次數',
  status: '狀態', isActive: '使用中', daysPerWeek: '每週天數', count: '次數', feeling: '感受', sleepH: '睡眠時數', energy: '精力', waterMl: '飲水（ml）',
  price: '價格', priceTwd: '價格（元）', servingsPerContainer: '每罐份數', servings: '份數', remaining: '剩餘量', brand: '品牌', target: '目標', value: '數值',
  foodKey: '食物項目代碼', meal: '餐次', amount: '數量', enabled: '啟用', targetValue: '目標值', startValue: '起始值',
};
const VALUE: Record<string, string> = { done: '已完成', active: '進行中', paused: '暫停', working: '正式組', warmup: '暖身組', drop: '遞減組', male: '男', female: '女', breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '點心' };
export function conflictTitle(row?: SyncRow): string {
  if (!row) return '已刪除的紀錄';
  return String(row.nameZh ?? row.name ?? row.dayName ?? row.type ?? row.norm ?? row.date ?? '同一筆紀錄');
}
export function RecordSummary({ row }: { row?: SyncRow }) {
  if (!row) return <p className="text-sm text-warn">這一邊已刪除此紀錄</p>;
  const rows: Array<[string, string]> = [];
  for (const [key, label] of Object.entries(LABEL)) {
    const v = row[key]; if (v == null || v === '' || typeof v === 'object') continue;
    rows.push([label, key === 'isActive' ? v === 1 ? '是' : '否' : typeof v === 'number' ? fmt(v, 2) : VALUE[String(v)] ?? String(v)]);
  }
  if (row.flags || row.discomfortArea) rows.push(['逐組狀態', observationText(row as Parameters<typeof observationText>[0])]);
  if (row.profile && typeof row.profile === 'object') {
    const p = row.profile as SyncRow;
    rows.push(['個人資料', [p.name, p.heightCm ? p.heightCm + ' cm' : '', p.birthYear ? p.birthYear + ' 年出生' : ''].filter(Boolean).join(' · ')]);
  }
  if (row.nutrition && typeof row.nutrition === 'object') {
    const n = row.nutrition as SyncRow; rows.push(['飲食目標', '熱量加成 ' + String(n.surplusKcal ?? '–') + ' kcal；蛋白質 ' + String(n.proteinPerKg ?? '–') + ' g/kg']);
  }
  const plan = Array.isArray(row.plan) ? row.plan : [];
  if (plan.length) rows.push(['當日動作', plan.map((p: SyncRow) => String(p.nameSnapshot ?? '動作') + ' ' + p.sets + ' 組').join('／')]);
  if (Array.isArray(row.days)) rows.push(['訓練日', row.days.map((d: SyncRow) => String(d.name)).join('／')]);
  if (typeof row.updatedAt === 'number' && row.updatedAt > 0) rows.push(['最後修改', new Date(row.updatedAt).toLocaleString('zh-TW')]);
  return <dl className="flex flex-col gap-2 text-sm">{rows.map(([label, value], i) => <div key={label + i}><dt className="text-chalk-3">{label}</dt><dd className="break-words text-chalk-2">{value}</dd></div>)}
    {!rows.length && <div><dt className="text-chalk-3">紀錄</dt><dd>此筆資料有差異，請選擇要保留的來源。</dd></div>}
  </dl>;
}
