// 自適應 TDEE（計畫演算法第 7 點）：用實際攝取與體重變化反推每日消耗，只給建議、不自動套用。
//   估計 TDEE ＝ 有效攝取日的平均熱量 − 體重斜率（kg/天，最小平方法）× 7700
// 規則：21 天視窗；有效攝取日 ≥ 14 天；體重 ≥ 10 天且跨 ≥ 14 天；
//      每次建議最多調整 ±150 kcal、套用後 7 天內不再建議；差距 < 50 kcal 不提示。

import { addDays, diffDays, type DateKey } from './dates';
import { KCAL_PER_KG } from './nutrition';

export const ADAPTIVE = {
  windowDays: 21,
  minIntakeDays: 14,
  minWeighDays: 10,
  minWeighSpanDays: 14,
  maxWeeklyChange: 150,
  minDelta: 50,
  applyEveryDays: 7,
  /** 沒有手動標記時，熱量達目標的這個比例才算「記錄完整」 */
  autoCompleteRatio: 0.7,
  minKcal: 800,
  maxKcal: 6000,
} as const;

export interface IntakeDay {
  date: DateKey;
  kcal: number;
  entries: number;
  /** 使用者手動標記；undefined = 依熱量自動判斷 */
  complete?: boolean;
}

/** 這天的攝取能不能拿來算（記錄不完整的日子會讓 TDEE 被低估） */
export function isEffectiveIntake(d: IntakeDay, targetKcal: number, ratio: number = ADAPTIVE.autoCompleteRatio): boolean {
  if (d.entries <= 0 || !(d.kcal > 0)) return false;
  if (d.complete === true) return true;
  if (d.complete === false) return false;
  return d.kcal >= targetKcal * ratio;
}

/** 最小平方斜率；x 少於兩個不同值時回傳 null */
export function leastSquaresSlope(points: Array<{ x: number; y: number }>): number | null {
  const n = points.length;
  if (n < 2) return null;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  return sxx === 0 ? null : sxy / sxx;
}

export interface AdaptiveInput {
  today: DateKey;
  intake: IntakeDay[];
  /** 每天的平均體重（kg） */
  weights: Map<DateKey, number>;
  targetKcal: number;
  /** 目前使用的 TDEE（已套用的自適應值或公式估算） */
  currentTdee: number;
  /** 上次套用自適應建議的日期 */
  lastAppliedDate: DateKey | null;
}

export type AdaptiveResult =
  | { status: 'insufficient'; effectiveDays: number; weighDays: number; weighSpanDays: number; from: DateKey; to: DateKey }
  | {
      status: 'ok';
      from: DateKey;
      to: DateKey;
      effectiveDays: number;
      weighDays: number;
      meanIntake: number;
      slopeKgPerWeek: number;
      estimate: number;
      /** 估計值 − 目前 TDEE */
      delta: number;
      /** 建議的新 TDEE；null 表示不需要或還不能調整 */
      suggestion: number | null;
      reason: 'apply' | 'small' | 'cooldown';
      nextApplyDate: DateKey | null;
    };

export function adaptiveTdee(input: AdaptiveInput): AdaptiveResult {
  // 今天通常還沒吃完：攝取看到昨天為止；體重含今天
  const to = addDays(input.today, -1);
  const from = addDays(input.today, -ADAPTIVE.windowDays);
  const effective = input.intake.filter((d) => d.date >= from && d.date <= to && isEffectiveIntake(d, input.targetKcal));
  const weighs = [...input.weights].filter(([d, v]) => d >= from && d <= input.today && Number.isFinite(v)).sort(([a], [b]) => a.localeCompare(b));
  const weighSpanDays = weighs.length >= 2 ? diffDays(weighs[0]![0], weighs.at(-1)![0]) : 0;
  if (effective.length < ADAPTIVE.minIntakeDays || weighs.length < ADAPTIVE.minWeighDays || weighSpanDays < ADAPTIVE.minWeighSpanDays) {
    return { status: 'insufficient', effectiveDays: effective.length, weighDays: weighs.length, weighSpanDays, from, to };
  }
  const slope = leastSquaresSlope(weighs.map(([d, v]) => ({ x: diffDays(from, d), y: v })))!;
  const meanIntake = effective.reduce((a, d) => a + d.kcal, 0) / effective.length;
  const estimate = meanIntake - slope * KCAL_PER_KG;
  const delta = estimate - input.currentTdee;
  const base = { status: 'ok' as const, from, to, effectiveDays: effective.length, weighDays: weighs.length, meanIntake, slopeKgPerWeek: slope * 7, estimate, delta };

  if (Math.abs(delta) < ADAPTIVE.minDelta) return { ...base, suggestion: null, reason: 'small', nextApplyDate: null };
  if (input.lastAppliedDate && diffDays(input.lastAppliedDate, input.today) < ADAPTIVE.applyEveryDays) {
    return { ...base, suggestion: null, reason: 'cooldown', nextApplyDate: addDays(input.lastAppliedDate, ADAPTIVE.applyEveryDays) };
  }
  const step = Math.max(-ADAPTIVE.maxWeeklyChange, Math.min(ADAPTIVE.maxWeeklyChange, delta));
  const suggestion = Math.min(ADAPTIVE.maxKcal, Math.max(ADAPTIVE.minKcal, Math.round((input.currentTdee + step) / 5) * 5));
  return { ...base, suggestion, reason: 'apply', nextApplyDate: null };
}
