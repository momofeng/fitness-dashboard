// 訓練頁用的彙整查詢（Dexie ＋ core 計算），給 useLiveQuery 使用。

import { addDays, diffDays, startOfWeek } from '../../core/dates';
import { detectStall } from '../../core/training/progression';
import { sessionBestE1rm } from '../../core/training/strength';
import { setsByMuscle, type MuscleVolume } from '../../core/training/volume';
import { db } from '../../db/db';
import { latestWeightKg } from '../../db/repo/body';
import { loadExerciseLookup } from '../../db/repo/exercises';
import { exerciseHistory } from '../../db/repo/workouts';
import type { Settings } from '../../db/schemas';

export async function weekVolume(today: string, weekStart: 0 | 1): Promise<{ volume: MuscleVolume; sessions: number; from: string }> {
  const from = startOfWeek(today, weekStart);
  const get = await loadExerciseLookup();
  const sets = await db.sets.where('date').between(from, addDays(from, 6), true, true).toArray();
  const workouts = await db.workouts.where('date').between(from, addDays(from, 6), true, true).toArray();
  return {
    volume: setsByMuscle(sets, (id) => get(id)),
    sessions: workouts.filter((w) => w.status === 'done').length,
    from,
  };
}

export interface ExerciseSeriesPoint {
  date: string;
  workoutId: string;
  best: number;
  topWeightKg: number;
  topReps: number;
}

/** 某動作每場的最佳 e1RM（給進步曲線與停滯偵測） */
export async function exerciseSeries(exerciseId: string, settings: Settings): Promise<ExerciseSeriesPoint[]> {
  const get = await loadExerciseLookup();
  const ex = get(exerciseId);
  if (!ex) return [];
  const bw = await latestWeightKg();
  const sets = await exerciseHistory(exerciseId);
  const byWorkout = new Map<string, typeof sets>();
  for (const s of sets) byWorkout.set(s.workoutId, [...(byWorkout.get(s.workoutId) ?? []), s]);
  const out: ExerciseSeriesPoint[] = [];
  for (const [workoutId, group] of byWorkout) {
    const best = sessionBestE1rm(group, { formula: settings.training.e1rmFormula, useRir: settings.training.useRir, loadType: ex.loadType, bodyweightKg: bw });
    const working = group.filter((s) => s.kind === 'working');
    if (best == null || !working.length) continue;
    const top = working.reduce((a, b) => (b.weightKg > a.weightKg || (b.weightKg === a.weightKg && b.reps > a.reps) ? b : a));
    out.push({ date: group[0]!.date, workoutId, best, topWeightKg: top.weightKg, topReps: top.reps });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export async function stalledExercises(exerciseIds: string[], settings: Settings, today: string) {
  const out: Array<{ exerciseId: string; daysSincePr: number }> = [];
  for (const id of [...new Set(exerciseIds)]) {
    const series = await exerciseSeries(id, settings);
    const r = detectStall(
      series.map((p) => ({ date: p.date, bestE1rm: p.best })),
      today,
      { sessions: settings.training.stallSessions, threshold: 1.01, minDays: settings.training.stallMinDays },
      diffDays,
    );
    if (r.stalled && r.daysSincePr != null) out.push({ exerciseId: id, daysSincePr: r.daysSincePr });
  }
  return out;
}
