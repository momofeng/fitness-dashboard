// 恢復：近幾天的睡眠、精力、痠痛摘要，以及依「停滯＋恢復不足」給的減量建議（計畫演算法第 6 點）。

import { addDays, type DateKey } from './dates';
import { floorTo } from './units';

export interface DayRecovery {
  date: DateKey;
  sleepHours?: number;
  energy?: number;
  soreness?: string[];
}

export interface RecoverySummary {
  /** 視窗內有任何恢復紀錄的天數 */
  loggedDays: number;
  sleepAvg: number | null;
  sleepDays: number;
  energyAvg: number | null;
  energyDays: number;
  /** 痠痛部位出現次數，多到少 */
  sore: Array<{ area: string; days: number }>;
}

/** today 往前 windowDays 天（含今天）的摘要 */
export function recoverySummary(logs: DayRecovery[], today: DateKey, windowDays = 7): RecoverySummary {
  const from = addDays(today, -(windowDays - 1));
  const inWin = logs.filter((l) => l.date >= from && l.date <= today);
  const sleep = inWin.filter((l) => l.sleepHours != null).map((l) => l.sleepHours!);
  const energy = inWin.filter((l) => l.energy != null).map((l) => l.energy!);
  const soreCount = new Map<string, number>();
  for (const l of inWin) for (const a of l.soreness ?? []) soreCount.set(a, (soreCount.get(a) ?? 0) + 1);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return {
    loggedDays: inWin.filter((l) => l.sleepHours != null || l.energy != null || (l.soreness?.length ?? 0) > 0).length,
    sleepAvg: avg(sleep),
    sleepDays: sleep.length,
    energyAvg: avg(energy),
    energyDays: energy.length,
    sore: [...soreCount].map(([area, days]) => ({ area, days })).sort((a, b) => b.days - a.days),
  };
}

export interface DeloadPrefs {
  /** 平均睡眠低於這個時數算不足 */
  lowSleepH: number;
  /** 平均精力不高於這個值算低落 */
  lowEnergy: number;
  /** 至少要有幾天紀錄才判斷恢復（預設 4／7） */
  minDays?: number;
}

export type AdviceLevel = 'ok' | 'watch' | 'deload';

export interface DeloadAdvice {
  level: AdviceLevel;
  title: string;
  reasons: string[];
  actions: string[];
  /** 是否提供「開始減量週」 */
  offerDeload: boolean;
}

const f1 = (v: number) => (Math.round(v * 10) / 10).toString();

/**
 * 減量建議：
 * - deload：有主項停滯，且近 7 天恢復不足（平均睡眠 < lowSleepH 或平均精力 ≤ lowEnergy，至少 minDays 天紀錄）
 * - watch：只有停滯（依序：檢查體重趨勢、睡眠，換次數範圍或動作變式，退 10% 重新往上加），
 *          或只有恢復不足，或停滯但沒有恢復紀錄
 * - ok：其他
 */
export function deloadAdvice(
  input: { stalled: string[]; summary: RecoverySummary; weightTrend: 'slow' | 'losing' | 'ok' | 'fast' | null },
  prefs: DeloadPrefs,
): DeloadAdvice {
  const minDays = prefs.minDays ?? 4;
  const s = input.summary;
  const lowSleep = s.sleepDays >= minDays && s.sleepAvg != null && s.sleepAvg < prefs.lowSleepH;
  const lowEnergy = s.energyDays >= minDays && s.energyAvg != null && s.energyAvg <= prefs.lowEnergy;
  const poor = lowSleep || lowEnergy;
  const hasData = Math.max(s.sleepDays, s.energyDays) >= minDays;
  const stalled = input.stalled.length > 0;

  const recoveryReasons: string[] = [];
  if (lowSleep) recoveryReasons.push(`近 7 天平均睡眠 ${f1(s.sleepAvg!)} 小時（低於 ${f1(prefs.lowSleepH)}）`);
  if (lowEnergy) recoveryReasons.push(`近 7 天平均精力 ${f1(s.energyAvg!)}／5（偏低）`);
  const stallReason = stalled ? `${input.stalled.join('、')} 停滯` : '';

  if (stalled && poor) {
    return {
      level: 'deload',
      title: '建議安排一週減量',
      reasons: [stallReason, ...recoveryReasons],
      actions: ['接下來 7 天：組數減少、重量降一點，動作照常練', '把睡眠補足，多數成人需要 7 小時以上', '減量週結束後回到原本的重量往上加'],
      offerDeload: true,
    };
  }
  if (stalled) {
    const actions: string[] = [];
    if (input.weightTrend === 'slow' || input.weightTrend === 'losing') actions.push('體重沒有增加：每天多吃約 150 kcal，兩週後再看');
    else actions.push('先看體重趨勢：增肌期體重應該緩慢上升');
    actions.push(hasData ? '睡眠與精力看起來還可以' : '記錄幾天睡眠與精力，才能判斷要不要減量');
    actions.push('換一個次數範圍（例如 5 下改 8–10 下）或動作變式');
    actions.push('或把重量退 10%，重新往上加');
    return { level: 'watch', title: '有動作停滯', reasons: [stallReason], actions, offerDeload: false };
  }
  if (poor) {
    return {
      level: 'watch',
      title: '恢復不足',
      reasons: recoveryReasons,
      actions: ['今天可以少做 1 組、不追求破紀錄', '優先把睡眠補足', '連續一週都這樣，可以考慮減量週'],
      offerDeload: false,
    };
  }
  if (!hasData) {
    return { level: 'ok', title: '還沒有足夠的恢復紀錄', reasons: [], actions: ['每天記錄睡眠與精力（約 5 秒），記滿 4 天就能判斷恢復狀況'], offerDeload: false };
  }
  return { level: 'ok', title: '恢復狀況正常', reasons: [], actions: [], offerDeload: false };
}

/** 減量週：組數 × setsPct%（至少 1 組），重量 × weightPct% 並往下對齊級距 */
export function deloadTarget(
  sets: number,
  weight: number | null,
  setsPct: number,
  weightPct: number,
  step: number,
): { sets: number; weight: number | null } {
  const nextSets = Math.max(1, Math.round((sets * setsPct) / 100));
  if (weight == null) return { sets: nextSets, weight: null };
  return { sets: nextSets, weight: Math.max(0, floorTo((weight * weightPct) / 100, step)) };
}
