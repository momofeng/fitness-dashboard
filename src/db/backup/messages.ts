// 匯入錯誤訊息的中文化（不依賴 Zod，畫面可以直接載入）。

const TYPE_ZH: Record<string, string> = { number: '數字', string: '文字', boolean: '是／否', array: '清單', object: '物件' };

/** Zod 的英文訊息轉成給使用者看的中文；schema 裡自訂的中文訊息照用 */
export function issueMessage(iss: { code: string; message: string; maximum?: unknown; minimum?: unknown; expected?: unknown; origin?: unknown }): string {
  if (/[一-鿿]/.test(iss.message)) return iss.message;
  const len = iss.origin === 'string' || iss.origin === 'array';
  switch (iss.code) {
    case 'too_big':
      return len ? `太長（最多 ${String(iss.maximum)}）` : `超過上限 ${String(iss.maximum)}`;
    case 'too_small':
      return len ? `太短（至少 ${String(iss.minimum)}）` : `低於下限 ${String(iss.minimum)}`;
    case 'invalid_type':
      return iss.expected ? `格式錯誤（應為${TYPE_ZH[String(iss.expected)] ?? String(iss.expected)}）` : '格式錯誤';
    case 'invalid_value':
      return '不是允許的選項';
    case 'invalid_format':
      return '格式錯誤';
    case 'unrecognized_keys':
      return '有無法辨識的欄位';
    default:
      return '資料格式錯誤';
  }
}

const FIELD_ZH: Record<string, string> = {
  date: '日期',
  dueDate: '期限',
  purchasedAt: '購買日期',
  weightKg: '體重',
  bodyFatPct: '體脂率',
  sleepHours: '睡眠時數',
  energy: '精力',
  soreness: '痠痛部位',
  waterMl: '喝水',
  price: '價格',
  servingsPerContainer: '每罐份數',
  proteinPerServingG: '每份蛋白質',
  servings: '份數',
  targetValue: '目標值',
  startValue: '起始值',
  name: '名稱',
  title: '名稱',
  reps: '次數',
  sets: '組數',
  kcal: '熱量',
  thumb: '縮圖',
  width: '寬度',
  height: '高度',
  id: '編號',
};

/** 欄位路徑轉成中文（找不到對照的保留原名） */
export function fieldLabel(path: string): string {
  return path
    .split('.')
    .map((k) => (/^\d+$/.test(k) ? `第 ${Number(k) + 1} 項` : (FIELD_ZH[k] ?? k)))
    .join(' › ');
}
