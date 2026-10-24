// 漸進超負荷規則：線性進步（新手主項）與雙重進步（輔助動作）。

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

/**
 * 依本次正式組表現，算出下次的工作重量。
 * 只看前 target.sets 個正式組；評估重量取其中最輕的一組，避免「最後一組減重」被誤判成加重成功。
 */
export function nextProgression(
  target: SlotTarget,
  state: ProgressState,
  workingSets: Array<{ weightKg: number; reps: number }>,
  prefs: ProgressionPrefs,
  stepKg: number,
): ProgressionResult {
  const counted = workingSets.slice(0, target.sets);
  if (counted.length === 0) {
    return { state, outcome: 'skipped', message: '本次沒有正式組，重量維持不變。', nextTargetReps: target.repMin, suggestSwitch: false };
  }
  const weight = Math.min(...counted.map((s) => s.weightKg));
  const complete = counted.length >= target.sets;
  const step = stepKg > 0 ? stepKg : target.incrementKg || 1;

  if (target.progression === 'none') {
    return {
      state: { ...state, workingWeightKg: weight },
      outcome: 'recorded',
      message: '已記錄本次重量。',
      nextTargetReps: target.repMin,
      suggestSwitch: false,
    };
  }

  const deload = (fails: number): ProgressionResult => {
    const next = Math.max(step, floorTo(weight * prefs.deloadFactor, step));
    const deloadCount = state.deloadCount + 1;
    return {
      state: { workingWeightKg: next, consecutiveFails: 0, deloadCount },
      outcome: 'deload',
      message: `連續 ${fails} 次未達標，下次減量到 ${next} kg 再往上加。`,
      nextTargetReps: target.repMin,
      suggestSwitch: deloadCount >= 2,
    };
  };

  if (target.progression === 'linear') {
    const success = complete && counted.every((s) => s.reps >= target.repMax);
    if (success) {
      const next = roundTo(weight + target.incrementKg, step);
      return {
        state: { ...state, workingWeightKg: next, consecutiveFails: 0 },
        outcome: 'increase',
        message: `全部達標！下次加到 ${next} kg。`,
        nextTargetReps: target.repMax,
        suggestSwitch: false,
      };
    }
    const fails = state.consecutiveFails + 1;
    if (fails >= prefs.failsBeforeDeload) return deload(fails);
    return {
      state: { ...state, workingWeightKg: weight, consecutiveFails: fails },
      outcome: 'fail',
      message: `未全部達標（第 ${fails} 次），下次維持 ${weight} kg 再挑戰。`,
      nextTargetReps: target.repMax,
      suggestSwitch: false,
    };
  }

  // 雙重進步
  const allAtTop = complete && counted.every((s) => s.reps >= target.repMax);
  if (allAtTop) {
    const next = roundTo(weight + target.incrementKg, step);
    return {
      state: { ...state, workingWeightKg: next, consecutiveFails: 0 },
      outcome: 'increase',
      message: `每組都做到 ${target.repMax} 下，下次加到 ${next} kg，次數回到 ${target.repMin} 下。`,
      nextTargetReps: target.repMin,
      suggestSwitch: false,
    };
  }
  const allInRange = complete && counted.every((s) => s.reps >= target.repMin);
  if (allInRange) {
    return {
      state: { ...state, workingWeightKg: weight, consecutiveFails: 0 },
      outcome: 'hold',
      message: `維持 ${weight} kg，目標把每組做到 ${target.repMax} 下。`,
      nextTargetReps: Math.min(target.repMax, Math.min(...counted.map((s) => s.reps)) + 1),
      suggestSwitch: false,
    };
  }
  const fails = state.consecutiveFails + 1;
  if (fails >= prefs.doubleFailsBeforeDeload) return deload(fails);
  return {
    state: { ...state, workingWeightKg: weight, consecutiveFails: fails },
    outcome: 'fail',
    message: `有組數低於 ${target.repMin} 下，下次維持 ${weight} kg。`,
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
