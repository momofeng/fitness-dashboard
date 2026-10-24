// 肌力相關計算：e1RM、PR、槓片配重、暖身組。

import type { LoadType } from '../../content/types';
import { roundTo } from '../units';

export type E1rmFormula = 'epley' | 'brzycki';
export type SetKind = 'warmup' | 'working' | 'drop';

export interface SetLike {
  weightKg: number;
  reps: number;
  rir?: number | null;
  kind: SetKind;
}

/** 超過這個次數（含 RIR）的組數不拿來估 1RM，誤差太大 */
export const MAX_E1RM_REPS = 12;

/**
 * 估算 1RM。回傳 null 代表這組不適合估算（次數太多或資料無效）。
 * useRir=true 時以「次數 + 保留次數」估算，例如 100 kg × 5 下、RIR 2 視同做到力竭 7 下。
 */
export function e1rm(
  weightKg: number,
  reps: number,
  formula: E1rmFormula = 'epley',
  rir?: number | null,
  useRir = false,
): number | null {
  if (!(weightKg > 0) || !(reps >= 1)) return null;
  const r = useRir && rir != null && rir > 0 ? reps + rir : reps;
  if (r > MAX_E1RM_REPS) return null;
  if (r === 1) return weightKg;
  return formula === 'epley' ? weightKg * (1 + r / 30) : (weightKg * 36) / (37 - r);
}

/** 依動作負荷型態換算實際負荷（自重動作要加上體重） */
export function effectiveLoad(loadType: LoadType, weightKg: number, bodyweightKg: number | null): number {
  switch (loadType) {
    case 'external':
      return weightKg;
    case 'bodyweightPlus':
      return (bodyweightKg ?? 0) + weightKg;
    case 'assisted':
      return Math.max(0, (bodyweightKg ?? 0) - weightKg);
    case 'bodyweight':
      return bodyweightKg ?? 0;
  }
}

export interface DatedSet extends SetLike {
  date: string;
  workoutId: string;
}

export interface PrSummary {
  bestE1rm: { value: number; date: string; weightKg: number; reps: number } | null;
  /** 次數 → 該次數做過的最大重量 */
  repMaxes: Map<number, { weightKg: number; date: string }>;
  bestSessionVolume: { value: number; date: string } | null;
}

export interface PrOptions {
  formula: E1rmFormula;
  useRir: boolean;
  loadType: LoadType;
  bodyweightKg: number | null;
}

/** 只用正式組計算 PR */
export function computePrs(sets: DatedSet[], opts: PrOptions): PrSummary {
  let bestE1rm: PrSummary['bestE1rm'] = null;
  const repMaxes: PrSummary['repMaxes'] = new Map();
  const volumeBySession = new Map<string, { value: number; date: string }>();
  for (const s of sets) {
    if (s.kind !== 'working' || s.reps < 1) continue;
    const load = effectiveLoad(opts.loadType, s.weightKg, opts.bodyweightKg);
    if (opts.loadType !== 'bodyweight') {
      const est = e1rm(load, s.reps, opts.formula, s.rir, opts.useRir);
      if (est != null && (bestE1rm == null || est > bestE1rm.value)) {
        bestE1rm = { value: est, date: s.date, weightKg: s.weightKg, reps: s.reps };
      }
      if (s.reps <= MAX_E1RM_REPS) {
        const prev = repMaxes.get(s.reps);
        if (!prev || s.weightKg > prev.weightKg) repMaxes.set(s.reps, { weightKg: s.weightKg, date: s.date });
      }
    }
    const v = volumeBySession.get(s.workoutId) ?? { value: 0, date: s.date };
    v.value += load * s.reps;
    volumeBySession.set(s.workoutId, v);
  }
  let bestSessionVolume: PrSummary['bestSessionVolume'] = null;
  for (const v of volumeBySession.values()) {
    if (!bestSessionVolume || v.value > bestSessionVolume.value) bestSessionVolume = v;
  }
  return { bestE1rm, repMaxes, bestSessionVolume };
}

/** 一場訓練中某動作的最佳 e1RM（給進步曲線與停滯偵測用） */
export function sessionBestE1rm(sets: SetLike[], opts: PrOptions): number | null {
  let best: number | null = null;
  for (const s of sets) {
    if (s.kind !== 'working') continue;
    const est = e1rm(effectiveLoad(opts.loadType, s.weightKg, opts.bodyweightKg), s.reps, opts.formula, s.rir, opts.useRir);
    if (est != null && (best == null || est > best)) best = est;
  }
  return best;
}

export interface PlateStock {
  kg: number;
  /** 可用的「對」數（兩側各一片算一對） */
  pairs: number;
}

export interface PlateLoadout {
  perSide: number[];
  achievedKg: number;
  exact: boolean;
}

/**
 * 槓片配重：依可用槓片找出每側要放哪些。
 * 先找剛好湊得出的組合（片數最少）；湊不出就給不超過目標的最接近重量。
 */
export function plateLoadout(targetKg: number, barKg: number, stock: PlateStock[]): PlateLoadout {
  const sideTarget = Math.round(((targetKg - barKg) / 2) * 1000);
  if (sideTarget <= 0) return { perSide: [], achievedKg: barKg, exact: targetKg === barKg };
  const plates = stock
    .filter((p) => p.kg > 0 && p.pairs > 0)
    .map((p) => ({ g: Math.round(p.kg * 1000), n: p.pairs }))
    .sort((a, b) => b.g - a.g);

  let best: { sum: number; count: number; picks: number[] } = { sum: 0, count: 0, picks: [] };
  const picks: number[] = [];
  let steps = 0;

  const dfs = (i: number, remaining: number, sum: number) => {
    if (++steps > 200_000) return;
    const better =
      sum > best.sum || (sum === best.sum && picks.length < best.count);
    if (better) best = { sum, count: picks.length, picks: [...picks] };
    if (remaining === 0 || i >= plates.length) return;
    const p = plates[i]!;
    const maxN = Math.min(p.n, Math.floor(remaining / p.g));
    for (let k = maxN; k >= 0; k--) {
      for (let j = 0; j < k; j++) picks.push(p.g);
      dfs(i + 1, remaining - k * p.g, sum + k * p.g);
      for (let j = 0; j < k; j++) picks.pop();
      if (best.sum === sideTarget && best.count <= picks.length + k) break;
    }
  };
  dfs(0, sideTarget, 0);

  const perSide = best.picks.map((g) => g / 1000);
  const achievedKg = Number((barKg + (best.sum / 1000) * 2).toFixed(3));
  return { perSide, achievedKg, exact: best.sum === sideTarget };
}

export interface WarmupSet {
  weightKg: number;
  reps: number;
}

/**
 * 暖身組：空槓×10、40%×5、60%×3、80%×2。
 * 低於空槓、與前一組差不到 10%、或太接近正式組重量的就略過。
 * barKg=0（啞鈴、器械）時不排空槓組。
 */
export function warmupSets(workingKg: number, barKg: number, stepKg: number): WarmupSet[] {
  if (!(workingKg > 0)) return [];
  const plan: Array<[number, number]> = [
    [0.4, 5],
    [0.6, 3],
    [0.8, 2],
  ];
  const out: WarmupSet[] = [];
  if (barKg > 0 && workingKg >= barKg * 1.25) out.push({ weightKg: barKg, reps: 10 });
  for (const [pct, reps] of plan) {
    const w = Math.max(barKg, roundTo(workingKg * pct, stepKg));
    const prev = out.at(-1)?.weightKg ?? 0;
    if (w <= 0 || w >= workingKg * 0.95) continue;
    if (prev > 0 && w < prev * 1.1) continue;
    out.push({ weightKg: w, reps });
  }
  return out;
}
