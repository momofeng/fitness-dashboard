// 單位換算與數字格式。儲存一律用 kg，只在顯示時換算。

export type WeightUnit = 'kg' | 'lb';

export const LB_PER_KG = 2.2046226218;

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

/** 顯示用：kg 轉成使用者單位 */
export function toDisplayWeight(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kgToLb(kg);
}

/** 輸入用：使用者單位轉回 kg */
export function fromDisplayWeight(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : lbToKg(value);
}

/** 四捨五入到 step 的倍數，並消掉浮點誤差（例如 52.50000001） */
export function roundTo(value: number, step: number): number {
  if (step <= 0) return value;
  const r = Math.round(value / step) * step;
  return Number(r.toFixed(6));
}

export function floorTo(value: number, step: number): number {
  if (step <= 0) return value;
  const r = Math.floor(value / step + 1e-9) * step;
  return Number(r.toFixed(6));
}

/** 去掉多餘小數：52.5 → "52.5"、60 → "60" */
export function fmt(value: number, maxDecimals = 1): string {
  if (!Number.isFinite(value)) return '–';
  const factor = 10 ** maxDecimals;
  const r = Math.round(value * factor) / factor;
  return r.toLocaleString('zh-TW', { maximumFractionDigits: maxDecimals });
}

export function fmtWeight(kg: number, unit: WeightUnit, maxDecimals = 1): string {
  return `${fmt(toDisplayWeight(kg, unit), maxDecimals)} ${unit}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
