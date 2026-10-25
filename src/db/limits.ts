// 數值範圍：Zod schema（匯入驗證）、輸入元件與寫入前的檢查共用同一份，
// 避免「畫面允許輸入、但備份還原時被擋下」——匯入是一筆錯就整批拒絕。

import { isDateKey } from '../core/dates';

export const LIMITS = {
  weightKg: [20, 400],
  bodyFatPct: [2, 70],
  circCm: [5, 300],
  waterMl: [0, 20000],
  planSets: [0, 20],
  heightCm: [100, 250],
  // ---- Round 2 ----
  /** 睡眠時數（小時） */
  sleepH: [0, 24],
  /** 精力 1–5 */
  energy: [1, 5],
  /** 價格（新台幣） */
  priceTwd: [0, 200000],
  servingsPerContainer: [1, 2000],
  proteinPerServingG: [0, 200],
  /** 每天預計吃幾份（估庫存用；0 = 不估） */
  dailyServings: [0, 20],
  /** 單次打卡份數 */
  logServings: [0.25, 20],
  /** 補貨提醒：剩幾天就提醒 */
  remindDays: [0, 60],
  containers: [0, 1000],
  /** 庫存校正（份） */
  adjustServings: [-5000, 5000],
  /** 動作目標重量（kg） */
  liftKg: [1, 1000],
  targetReps: [1, 12],
  customGoal: [-1_000_000, 1_000_000],
  habitPerWeek: [1, 7],
  /** 自適應 TDEE 的覆寫值 */
  tdeeKcal: [800, 6000],
  warmupPct: [10, 95],
  warmupReps: [1, 20],
  warmupBarReps: [0, 20],
  warmupSteps: [0, 6],
  /** 停滯判定：沒有超過先前最佳的幾 %（0 = 只要沒創新高就算） */
  stallThresholdPct: [0, 10],
  ezBarKg: [0, 30],
  barLb: [0, 100],
  plateLb: [0.5, 100],
  platePairs: [0, 20],
  lowSleepH: [3, 10],
  lowEnergy: [1, 4],
  deloadSetsPct: [30, 100],
  deloadWeightPct: [50, 100],
  /** 進度照原圖的長、寬（像素） */
  photoPx: [1, 1080],
  photoBytes: [1, 5_000_000],
} as const;

export type LimitKey = keyof typeof LIMITS;

export function inRange(key: LimitKey, v: number): boolean {
  const [lo, hi] = LIMITS[key];
  return Number.isFinite(v) && v >= lo && v <= hi;
}

export function clampTo(key: LimitKey, v: number): number {
  const [lo, hi] = LIMITS[key];
  return Math.min(hi, Math.max(lo, v));
}

export function rangeText(key: LimitKey, unit = '', toDisplay: (v: number) => number = (v) => v): string {
  const [lo, hi] = LIMITS[key];
  const f = (v: number) => Number(toDisplay(v).toFixed(1));
  return `請輸入 ${f(lo)}–${f(hi)}${unit}`;
}

/** 超出範圍就丟 RangeError（repo 寫入前用；畫面層應先擋下，這裡是最後防線） */
export function assertRange(key: LimitKey, v: number | null | undefined, label: string = key): void {
  if (v == null) return;
  if (!inRange(key, v)) {
    const [lo, hi] = LIMITS[key];
    throw new RangeError(`${label} 超出範圍（${lo}–${hi}）：${v}`);
  }
}

// ---------- 日期 ----------

/** 寫入的日期必須是合法的 YYYY-MM-DD，年份在這個範圍內（擋下鍵盤打出的 0026-…、20261-…） */
export const YEAR_RANGE = [2000, 2100] as const;

export function isValidDay(key: string | null | undefined): key is string {
  if (!key || !isDateKey(key)) return false;
  const y = Number(key.slice(0, 4));
  return y >= YEAR_RANGE[0] && y <= YEAR_RANGE[1];
}

export function assertDay(key: string | null | undefined, label = '日期'): void {
  if (!isValidDay(key)) throw new RangeError(`${label}格式不正確：${key ?? '（空白）'}`);
}

// ---------- 進度照 ----------

export const PHOTO = {
  /** 原圖長邊 */
  fullLongSide: 1080,
  fullQuality: 0.8,
  /** 縮圖長邊 */
  thumbLongSide: 240,
  thumbQuality: 0.7,
  /** 縮圖 data URL 最長字元數（240px JPEG 通常 10–30 KB） */
  thumbMaxChars: 200_000,
  /** 一次選取的原始檔案上限 */
  inputMaxBytes: 40 * 1024 * 1024,
} as const;

// ---------- 目標 ----------

export type GoalType = 'bodyweight' | 'lift' | 'bodyFat' | 'circ' | 'custom';

/** 各類目標的數值範圍（kg、%、cm 或自訂單位） */
export function goalValueRange(type: GoalType): readonly [number, number] {
  switch (type) {
    case 'bodyweight':
      return LIMITS.weightKg;
    case 'lift':
      return LIMITS.liftKg;
    case 'bodyFat':
      return LIMITS.bodyFatPct;
    case 'circ':
      return LIMITS.circCm;
    case 'custom':
      return LIMITS.customGoal;
  }
}
