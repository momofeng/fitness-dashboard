// 數值範圍：Zod schema（匯入驗證）、輸入元件與寫入前的檢查共用同一份，
// 避免「畫面允許輸入、但備份還原時被擋下」——匯入是一筆錯就整批拒絕。

export const LIMITS = {
  weightKg: [20, 400],
  bodyFatPct: [2, 70],
  circCm: [5, 300],
  waterMl: [0, 20000],
  planSets: [0, 20],
  heightCm: [100, 250],
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
