// 漸進超負荷規則：線性進步（新手主項）與雙重進步（輔助動作）。
// 單位無關：呼叫端可以全用 kg 或全用 lb（重量、加重量、級距、下限同一單位）。

import type { Equipment, ProgressionKind } from '../../content/types';
import { floorTo, roundTo } from '../units';

export interface ProgressState {
  workingWeightKg: number | null;
  consecutiveFails: number;
  deloadCount: number;
}

export const EMPTY_STATE: ProgressState = { workingWeightKg: null, consecutiveFails: 0, deloadCount: 0 };

export interface SlotTarget {
  sets: number;
  repMin: number;
  repMax: number;
  progression: ProgressionKind;
  incrementKg: number;
}

export interface ProgressionPrefs {
  /** 線性進步連續失敗幾次後減量 */
  failsBeforeDeload: number;
  /** 雙重進步同重量連續低於 repMin 幾次後減量 */
  doubleFailsBeforeDeload: number;
  deloadFactor: number;
}

export const DEFAULT_PROGRESSION_PREFS: ProgressionPrefs = {
  failsBeforeDeload: 3,
  doubleFailsBeforeDeload: 2,
  deloadFactor: 0.9,
};

export interface ProgressionOptions {
  /**
   * 1：重量越重越難（一般動作）；-1：數字越小越難（輔助引體這類「輔助重量」），
   * 進步＝減少輔助、減量＝增加輔助
   */
  direction?: 1 | -1;
  /** 減量後的最低重量（例如槓鈴不能低於空槓） */
  minWeight?: number;
  /** 顯示用單位 */
  unit?: string;
}

export type Outcome = 'increase' | 'hold' | 'fail' | 'deload' | 'skipped' | 'recorded';

export interface ProgressionResult {
  state: ProgressState;
  outcome: Outcome;
  message: string;
  /** 建議的下次目標次數（雙重進步加重後回到 repMin） */
  nextTargetReps: number;
  /** 第二次以上減量時，建議換進步方式 */
  suggestSwitch: boolean;
}

const n2 = (v: number) => Number(v.toFixed(2));

/**
 * 依本次正式組表現，算出下次的工作重量。
 * 只看前 target.sets 個正式組；評估重量取「最容易」的那一組（一般動作取最輕、輔助動作取輔助最多），
 * 避免「最後一組減重」被誤判成加重成功。
 */
export function nextProgression(
  target: SlotTarget,
  state: ProgressState,
  workingSets: Array<{ weightKg: number; reps: number }>,
  prefs: ProgressionPrefs,
  stepKg: number,
  opts: ProgressionOptions = {},
): ProgressionResult {
  const dir = opts.direction ?? 1;
  const unit = opts.unit ?? 'kg';
  const assisted = dir === -1;
  const counted = workingSets.slice(0, target.sets);
  if (counted.length === 0) {
    return { state, outcome: 'skipped', message: '本次沒有正式組，重量維持不變。', nextTargetReps: target.repMin, suggestSwitch: false };
  }
  const weights = counted.map((s) => s.weightKg);
  const weight = assisted ? Math.max(...weights) : Math.min(...weights);
  const complete = counted.length >= target.sets;
  const step = stepKg > 0 ? stepKg : target.incrementKg || 1;
  const w = (v: number) => `${n2(v)} ${unit}`;
  const noLoad = target.incrementKg <= 0;

  if (target.progression === 'none') {
    return {
      state: { ...state, workingWeightKg: weight },
      outcome: 'recorded',
      message: '已記錄本次重量。',
      nextTargetReps: target.repMin,
      suggestSwitch: false,
    };
  }

  const harder = (): number => (assisted ? Math.max(0, roundTo(weight - target.incrementKg, step)) : roundTo(weight + target.incrementKg, step));

  const deload = (fails: number): ProgressionResult => {
    const next = assisted
      ? roundTo(weight + Math.max(step, weight * (1 - prefs.deloadFactor)), step)
      : Math.max(opts.minWeight ?? step, floorTo(weight * prefs.deloadFactor, step));
    const deloadCount = state.deloadCount + 1;
    return {
      state: { workingWeightKg: n2(next), consecutiveFails: 0, deloadCount },
      outcome: 'deload',
      message: assisted ? `連續 ${fails} 次未達標，下次輔助加回 ${w(next)} 再慢慢減少。` : `連續 ${fails} 次未達標，下次減量到 ${w(next)} 再往上加。`,
      nextTargetReps: target.repMin,
      suggestSwitch: deloadCount >= 2,
    };
  };

  const increaseMsg = (next: number, tail = '') =>
    assisted ? `全部達標！下次輔助減到 ${w(next)}${tail}。` : `全部達標！下次加到 ${w(next)}${tail}。`;

  // 純徒手（不加重）：做到上限就提示加難度，不改重量
  const topOut = (): ProgressionResult => ({
    state: { ...state, workingWeightKg: weight, consecutiveFails: 0 },
    outcome: 'hold',
    message: `每組都做到 ${target.repMax} 下了！下次可以放慢動作、加負重或換更難的變式。`,
    nextTargetReps: target.repMax,
    suggestSwitch: false,
  });

  if (target.progression === 'linear') {
    const success = complete && counted.every((s) => s.reps >= target.repMax);
    if (success) {
      if (noLoad) return topOut();
      const next = harder();
      return {
        state: { ...state, workingWeightKg: n2(next), consecutiveFails: 0 },
        outcome: 'increase',
        message: increaseMsg(next),
        nextTargetReps: target.repMax,
        suggestSwitch: false,
      };
    }
    const fails = state.consecutiveFails + 1;
    if (fails >= prefs.failsBeforeDeload && !noLoad) return deload(fails);
    return {
      state: { ...state, workingWeightKg: weight, consecutiveFails: fails },
      outcome: 'fail',
      message: `未全部達標（第 ${fails} 次），下次維持 ${w(weight)} 再挑戰。`,
      nextTargetReps: target.repMax,
      suggestSwitch: false,
    };
  }

  // 雙重進步
  const allAtTop = complete && counted.every((s) => s.reps >= target.repMax);
  if (allAtTop) {
    if (noLoad) return topOut();
    const next = harder();
    return {
      state: { ...state, workingWeightKg: n2(next), consecutiveFails: 0 },
      outcome: 'increase',
      message: increaseMsg(next, `，次數回到 ${target.repMin} 下`),
      nextTargetReps: target.repMin,
      suggestSwitch: false,
    };
  }
  const allInRange = complete && counted.every((s) => s.reps >= target.repMin);
  if (allInRange) {
    return {
      state: { ...state, workingWeightKg: weight, consecutiveFails: 0 },
      outcome: 'hold',
      message: noLoad ? `目標把每組做到 ${target.repMax} 下。` : `維持 ${w(weight)}，目標把每組做到 ${target.repMax} 下。`,
      nextTargetReps: Math.min(target.repMax, Math.min(...counted.map((s) => s.reps)) + 1),
      suggestSwitch: false,
    };
  }
  const fails = state.consecutiveFails + 1;
  if (fails >= prefs.doubleFailsBeforeDeload && !noLoad) return deload(fails);
  return {
    state: { ...state, workingWeightKg: weight, consecutiveFails: fails },
    outcome: 'fail',
    message: noLoad ? `有組數低於 ${target.repMin} 下，下次再挑戰。` : `有組數低於 ${target.repMin} 下，下次維持 ${w(weight)}。`,
    nextTargetReps: target.repMin,
    suggestSwitch: false,
  };
}

export interface RoundingPrefs {
  /** 最小槓片（單片 kg），槓鈴類每次最小變化是兩倍 */
  smallestPlateKg: number;
  dumbbellStepKg: number;
  machineStepKg: number;
}

/** 依器材決定重量要對齊的級距 */
export function roundingStepFor(equipment: Equipment, prefs: RoundingPrefs): number {
  switch (equipment) {
    case 'barbell':
    case 'smith':
    case 'ezbar':
      return prefs.smallestPlateKg * 2;
    case 'dumbbell':
    case 'kettlebell':
      return prefs.dumbbellStepKg;
    case 'machine':
    case 'cable':
      return prefs.machineStepKg;
    default:
      return prefs.smallestPlateKg;
  }
}

/** 磅制：以常見的 lb 槓片／啞鈴級距計算，並把公斤的加重量換成整齊的磅數 */
export function lbStepFor(equipment: Equipment): number {
  return equipment === 'bodyweight' || equipment === 'band' ? 2.5 : 5;
}

export function kgIncrementToLb(incKg: number): number {
  if (incKg <= 0) return 0;
  return Math.max(2.5, Math.round((incKg * 2.2046226218) / 2.5) * 2.5);
}

export interface StallInput {
  date: string;
  bestE1rm: number;
}

/**
 * 停滯偵測：最近 n 次的最佳 e1RM 都沒有超過先前最佳 × threshold，
 * 且距離上次創新高已經至少 minDays 天。
 */
export function detectStall(
  sessions: StallInput[],
  today: string,
  opts: { sessions: number; threshold: number; minDays: number },
  diffDays: (a: string, b: string) => number,
): { stalled: boolean; daysSincePr: number | null } {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < opts.sessions + 1) return { stalled: false, daysSincePr: null };
  const recent = sorted.slice(-opts.sessions);
  const prior = sorted.slice(0, -opts.sessions);
  let priorBest = prior[0]!;
  for (const s of prior) if (s.bestE1rm > priorBest.bestE1rm) priorBest = s;
  const noProgress = recent.every((s) => s.bestE1rm <= priorBest.bestE1rm * opts.threshold);
  const daysSincePr = diffDays(priorBest.date, today);
  return { stalled: noProgress && daysSincePr >= opts.minDays, daysSincePr };
}
