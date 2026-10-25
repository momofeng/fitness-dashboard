// 目標進度與習慣判定。純函式：資料由呼叫端整理好傳進來。

import { addDays, diffDays, startOfWeek, type DateKey } from './dates';

export interface GoalProgress {
  /** 0–1；沒有目前值時為 null */
  pct: number | null;
  done: boolean;
  /** 距離目標還差多少（同單位，正數） */
  remaining: number | null;
  /** 目標是往上（增重、加重量）還是往下（腰圍、體脂） */
  direction: 'up' | 'down';
}

/**
 * 進度。direction 由建立時決定（動作目標一律往上）；沒給時才依起點推算。
 * start 沒有時視為與目前值相同（從 0% 開始），但「達成」只看目前值是否越過目標。
 */
export function goalProgress(start: number | null, target: number, current: number | null, dir?: 'up' | 'down'): GoalProgress {
  const base = start ?? current;
  const direction: 'up' | 'down' = dir ?? (base == null || target >= base ? 'up' : 'down');
  if (current == null) return { pct: null, done: false, remaining: null, direction };
  const done = direction === 'up' ? current >= target : current <= target;
  const from = base ?? current;
  const span = target - from;
  const raw = span === 0 ? 0 : (current - from) / span;
  const pct = done ? 1 : Math.min(1, Math.max(0, raw));
  return { pct, done, remaining: done ? 0 : Math.abs(target - current), direction };
}

/** 新目標的預設方向 */
export function defaultGoalDirection(type: string, circ: string | null): 'up' | 'down' {
  if (type === 'bodyFat') return 'down';
  if (type === 'circ') return circ === 'waist' || circ === 'hip' ? 'down' : 'up';
  return 'up';
}

/** 動作目標「X kg × N 下」：做到至少 N 下的正式組中最重的重量 */
export function bestWeightForReps(sets: Array<{ kind: string; weightKg: number; reps: number }>, reps: number): number | null {
  let best: number | null = null;
  for (const s of sets) if (s.kind === 'working' && s.reps >= reps && (best == null || s.weightKg > best)) best = s.weightKg;
  return best;
}

/** 截止日剩幾天（過了是負數） */
export function daysLeft(dueDate: DateKey | null, today: DateKey): number | null {
  return dueDate ? diffDays(today, dueDate) : null;
}

// ---------- 習慣 ----------

/** 蛋白質「達標」：吃到目標的 90%（每週營養頁、習慣、月曆共用） */
export const PROTEIN_HIT_RATIO = 0.9;

/** 「睡滿目標時數」的目標（小時） */
export const SLEEP_GOAL_H = 7;

export interface DayFacts {
  weighed: boolean;
  proteinG: number;
  foodLogged: boolean;
  waterMl: number;
  sleepH: number | null;
  workout: boolean;
  supplement: boolean;
}

export const EMPTY_DAY: DayFacts = { weighed: false, proteinG: 0, foodLogged: false, waterMl: 0, sleepH: null, workout: false, supplement: false };

export interface HabitTargets {
  proteinG: number | null;
  waterMl: number;
}

/** 自動判定的習慣在某天是否完成；manual 由打卡決定 */
export function autoHabitDone(rule: string, d: DayFacts, t: HabitTargets): boolean {
  switch (rule) {
    case 'weighIn':
      return d.weighed;
    case 'protein':
      return t.proteinG != null && t.proteinG > 0 && d.proteinG >= t.proteinG * PROTEIN_HIT_RATIO;
    case 'water':
      return t.waterMl > 0 && d.waterMl >= t.waterMl;
    case 'sleep':
      return d.sleepH != null && d.sleepH >= SLEEP_GOAL_H;
    case 'workout':
      return d.workout;
    case 'logFood':
      return d.foodLogged;
    case 'supplement':
      return d.supplement;
    default:
      return false;
  }
}

/** 本週（含今天）完成幾天 */
export function weekCount(doneDates: Set<DateKey>, today: DateKey, weekStart: 0 | 1): number {
  const from = startOfWeek(today, weekStart);
  let n = 0;
  for (let d = from; d <= today; d = addDays(d, 1)) if (doneDates.has(d)) n += 1;
  return n;
}

// ---------- 月曆 ----------

/** 月曆格：每列 7 格，月份以外的格子是 null */
export function monthGrid(year: number, month: number, weekStart: 0 | 1): Array<Array<DateKey | null>> {
  const pad = (n: number) => String(n).padStart(2, '0');
  const first = `${year}-${pad(month)}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const lead = (new Date(year, month - 1, 1).getDay() - weekStart + 7) % 7;
  const cells: Array<DateKey | null> = Array.from({ length: lead }, () => null);
  for (let i = 0; i < daysInMonth; i++) cells.push(addDays(first, i));
  while (cells.length % 7) cells.push(null);
  const rows: Array<Array<DateKey | null>> = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export type HeatMetric = 'training' | 'protein' | 'habits' | 'sleep';

/**
 * 熱圖等級 0–4（0 = 沒有資料）：
 * - training：正式組數 1–9 / 10–15 / 16–20 / 21+
 * - protein：達成率 <50% / 50–80% / 80–90% / ≥90%
 * - habits：完成比例 ≤1/3 / ≤2/3 / <1 / 全部
 * - sleep：<5 / 5–6 / 6–7 / ≥7 小時
 */
export function heatLevel(metric: HeatMetric, value: number | null): 0 | 1 | 2 | 3 | 4 {
  if (value == null || !(value > 0)) return 0;
  const steps: Record<HeatMetric, [number, number, number]> = {
    training: [10, 16, 21],
    protein: [0.5, 0.8, PROTEIN_HIT_RATIO],
    habits: [1 / 3 + 1e-9, 2 / 3 + 1e-9, 1],
    sleep: [5, 6, SLEEP_GOAL_H],
  };
  const [a, b, c] = steps[metric];
  if (value >= c) return 4;
  if (value >= b) return 3;
  if (value >= a) return 2;
  return 1;
}
