// 目標、習慣、月曆用的每日資料彙整（Dexie 查詢＋core 計算）。

import { dailyAverages, latestValue, movingAverage } from '../../core/body';
import { rangeKeys, type DateKey } from '../../core/dates';
import { autoHabitDone, bestWeightForReps, EMPTY_DAY, type DayFacts, type HabitTargets } from '../../core/goals';
import { db } from '../../db/db';
import { exerciseHistory } from '../../db/repo/workouts';
import type { Goal, Habit } from '../../db/schemas';

export interface DayFactsPlus extends DayFacts {
  workingSets: number;
}

/** from～to（含）每天的事實：有沒有量體重、蛋白質、喝水、睡眠、訓練、補給品打卡 */
export async function loadDayFacts(from: DateKey, to: DateKey): Promise<Map<DateKey, DayFactsPlus>> {
  const r = [from, to, true, true] as const;
  const [foods, daily, body, workouts, supps, sets] = await Promise.all([
    db.foodLogs.where('date').between(...r).toArray(),
    db.dailyLogs.where('date').between(...r).toArray(),
    db.bodyMetrics.where('date').between(...r).toArray(),
    db.workouts.where('date').between(...r).toArray(),
    db.supplementLogs.where('date').between(...r).toArray(),
    db.sets.where('date').between(...r).toArray(),
  ]);
  const out = new Map<DateKey, DayFactsPlus>(rangeKeys(from, to).map((d) => [d, { ...EMPTY_DAY, workingSets: 0 }]));
  const at = (d: DateKey) => out.get(d);
  for (const f of foods) {
    const x = at(f.date);
    if (!x) continue;
    x.foodLogged = true;
    x.proteinG += f.protein;
  }
  for (const l of daily) {
    const x = at(l.date);
    if (!x) continue;
    x.waterMl = l.waterMl;
    x.sleepH = l.sleepHours ?? null;
  }
  for (const b of body) {
    const x = at(b.date);
    if (x && b.weightKg != null) x.weighed = true;
  }
  for (const w of workouts) {
    const x = at(w.date);
    if (x && w.status === 'done') x.workout = true;
  }
  for (const s of supps) {
    const x = at(s.date);
    if (x) x.supplement = true;
  }
  for (const s of sets) {
    const x = at(s.date);
    if (x && s.kind === 'working') x.workingSets += 1;
  }
  return out;
}

/** 某習慣在哪些日子完成（手動看打卡、其他依當天資料判定） */
export function habitDoneDates(habit: Habit, facts: Map<DateKey, DayFacts>, manual: Set<string>, targets: HabitTargets): Set<DateKey> {
  const out = new Set<DateKey>();
  for (const [d, f] of facts) {
    const done = habit.rule === 'manual' ? manual.has(`${habit.id}:${d}`) : autoHabitDone(habit.rule, f, targets);
    if (done) out.add(d);
  }
  return out;
}

/** 目標的目前值（kg、%、cm 或自訂單位）；沒有資料時為 null */
export async function goalCurrent(g: Pick<Goal, 'type' | 'exerciseId' | 'targetReps' | 'circ' | 'current'>, today: DateKey): Promise<number | null> {
  switch (g.type) {
    case 'bodyweight': {
      const rows = await db.bodyMetrics.toArray();
      const w = rows.filter((r) => r.weightKg != null).map((r) => ({ date: r.date, value: r.weightKg! }));
      return movingAverage(dailyAverages(w), today, 7, 1) ?? latestValue(w)?.value ?? null;
    }
    case 'lift':
      return g.exerciseId && g.targetReps ? bestWeightForReps(await exerciseHistory(g.exerciseId), g.targetReps) : null;
    case 'bodyFat': {
      const rows = await db.bodyMetrics.toArray();
      return latestValue(rows.filter((r) => r.bodyFatPct != null).map((r) => ({ date: r.date, value: r.bodyFatPct! })))?.value ?? null;
    }
    case 'circ': {
      if (!g.circ) return null;
      const key = g.circ;
      const rows = await db.bodyMetrics.toArray();
      return latestValue(rows.filter((r) => r.circ[key] != null).map((r) => ({ date: r.date, value: r.circ[key]! })))?.value ?? null;
    }
    case 'custom':
      return g.current;
  }
}
