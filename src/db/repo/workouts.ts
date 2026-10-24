// 訓練的讀寫：開始、記組、完成（套用進步規則、算 PR）、刪除。
// 每記一組就寫進 DB，閃退或重新整理都能接著做。

import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ProgramDay } from '../../content/types';
import { todayKey } from '../../core/dates';
import { computePrs, type DatedSet } from '../../core/training/strength';
import { EMPTY_STATE, kgIncrementToLb, lbStepFor, nextProgression, roundingStepFor } from '../../core/training/progression';
import { fmt, kgToLb, lbToKg } from '../../core/units';
import { loadExerciseLookup, type AnyExercise } from './exercises';
import { db, newId } from '../db';
import { clampTo } from '../limits';
import { barKgFor, smallestPlateKg, smallestPlateLb } from '../defaults';
import type { PlanItem, Program, Workout, WorkoutSet } from '../schemas';
import { latestWeightKg } from './body';
import { getSettings } from './settings';

type Lookup = (id: string) => AnyExercise | undefined;

/** 某動作最近一場（不含 excludeWorkoutId）的組數 */
export async function lastSessionSets(exerciseId: string, excludeWorkoutId?: string): Promise<WorkoutSet[]> {
  const rows = await db.sets
    .where('[exerciseId+date]')
    .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
    .reverse()
    .toArray();
  const first = rows.find((r) => r.workoutId !== excludeWorkoutId);
  if (!first) return [];
  return rows.filter((r) => r.workoutId === first.workoutId).sort((a, b) => a.order - b.order);
}

export async function exerciseHistory(exerciseId: string): Promise<WorkoutSet[]> {
  return db.sets.where('[exerciseId+date]').between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey]).toArray();
}

export async function planItemFor(
  slot: { exerciseId: string; sets: number; repMin: number; repMax: number; restSec: number; progression: PlanItem['progression']; incrementKg?: number; supersetGroup?: number },
  get: Lookup,
): Promise<PlanItem> {
  const [pref, state, last] = await Promise.all([
    db.exercisePrefs.get(slot.exerciseId),
    db.progressionState.get(slot.exerciseId),
    lastSessionSets(slot.exerciseId),
  ]);
  const ex = get(slot.exerciseId);
  const lastWorking = last.filter((s) => s.kind === 'working');
  // 使用者在動作頁設的次數區間優先於課表（兩個都有才生效）
  const override = pref?.repMin != null && pref.repMax != null && pref.repMin <= pref.repMax;
  const repMin = override ? pref.repMin! : slot.repMin;
  const repMax = override ? pref.repMax! : slot.repMax;
  const targetReps =
    slot.progression === 'linear' ? repMax : Math.min(repMax, Math.max(repMin, state?.nextTargetReps ?? repMin));
  return {
    exerciseId: slot.exerciseId,
    sets: slot.sets,
    repMin,
    repMax,
    restSec: pref?.restSec ?? slot.restSec,
    progression: slot.progression,
    // 使用者在動作頁設的加重量優先於課表預設
    incrementKg: pref?.incrementKg ?? slot.incrementKg ?? ex?.defaultIncrementKg ?? 2.5,
    targetWeightKg: state?.workingWeightKg ?? (lastWorking.length ? Math.min(...lastWorking.map((s) => s.weightKg)) : null),
    targetReps,
    supersetGroup: slot.supersetGroup,
  };
}

export async function startWorkout(opts: { program?: Program; dayIndex?: number; date?: string }): Promise<string> {
  const settings = await getSettings();
  const get = await loadExerciseLookup();
  const existing = await db.workouts.where('status').equals('active').first();
  if (existing) return existing.id;
  let day: ProgramDay | undefined;
  if (opts.program) day = opts.program.days[opts.dayIndex ?? opts.program.nextDayIndex % opts.program.days.length];
  const plan = day ? await Promise.all(day.slots.map((s) => planItemFor(s, get))) : [];
  const now = Date.now();
  const w: Workout = {
    id: newId(),
    date: opts.date ?? todayKey(settings.dayCutoffHour),
    status: 'active',
    programId: opts.program?.id ?? null,
    dayId: day?.id ?? null,
    dayName: day?.name ?? '自由訓練',
    plan,
    startedAt: now,
    endedAt: null,
    restEndsAt: null,
    notes: '',
    summary: null,
    updatedAt: now,
  };
  await db.workouts.put(w);
  return w.id;
}

export async function addExerciseToWorkout(workoutId: string, exerciseId: string, defaultRestSec: number) {
  const get = await loadExerciseLookup();
  const ex = get(exerciseId);
  const [lo, hi] = ex?.defaultRepRange ?? [8, 12];
  const item = await planItemFor({ exerciseId, sets: 3, repMin: lo, repMax: hi, restSec: defaultRestSec, progression: 'double' }, get);
  await db.transaction('rw', db.workouts, async () => {
    const w = await db.workouts.get(workoutId);
    if (!w) return;
    await db.workouts.update(workoutId, { plan: [...w.plan, item], updatedAt: Date.now() });
  });
}

export async function updatePlanItem(workoutId: string, index: number, patch: Partial<PlanItem>) {
  await db.transaction('rw', db.workouts, async () => {
    const w = await db.workouts.get(workoutId);
    if (!w || !w.plan[index]) return;
    const safe = patch.sets != null ? { ...patch, sets: Math.round(clampTo('planSets', patch.sets)) } : patch;
    const plan = w.plan.map((p, i) => (i === index ? { ...p, ...safe } : p));
    await db.workouts.update(workoutId, { plan, updatedAt: Date.now() });
  });
}

export interface RemovedPlanItem {
  index: number;
  item: PlanItem;
  sets: WorkoutSet[];
}

/** 從這場訓練移除某動作（連同已記錄的組）；回傳的資料可交給 restorePlanItem 復原 */
export async function removePlanItem(workoutId: string, index: number): Promise<RemovedPlanItem | null> {
  return db.transaction('rw', db.workouts, db.sets, async () => {
    const w = await db.workouts.get(workoutId);
    const item = w?.plan[index];
    if (!w || !item) return null;
    const stillUsed = w.plan.some((p, i) => i !== index && p.exerciseId === item.exerciseId);
    const sets = stillUsed ? [] : await db.sets.where({ workoutId }).filter((s) => s.exerciseId === item.exerciseId).toArray();
    if (sets.length) await db.sets.bulkDelete(sets.map((s) => s.id));
    await db.workouts.update(workoutId, { plan: w.plan.filter((_, i) => i !== index), updatedAt: Date.now() });
    return { index, item, sets };
  });
}

export async function restorePlanItem(workoutId: string, removed: RemovedPlanItem) {
  await db.transaction('rw', db.workouts, db.sets, async () => {
    const w = await db.workouts.get(workoutId);
    if (!w) return;
    const plan = [...w.plan];
    plan.splice(Math.min(removed.index, plan.length), 0, removed.item);
    await db.workouts.update(workoutId, { plan, updatedAt: Date.now() });
    if (removed.sets.length) await db.sets.bulkPut(removed.sets);
  });
}

/**
 * 換動作：還沒記錄任何組就直接替換；已經有記錄的組則保留舊動作（組數改成已完成的組數），
 * 新動作插在它後面，不會刪掉已經練完的組。回傳是否保留了舊動作。
 */
export async function swapPlanExercise(workoutId: string, index: number, exerciseId: string): Promise<'replaced' | 'kept'> {
  const get = await loadExerciseLookup();
  return db.transaction('rw', db.workouts, db.sets, db.exercisePrefs, db.progressionState, async () => {
    const w = await db.workouts.get(workoutId);
    const item = w?.plan[index];
    if (!w || !item) return 'replaced';
    const logged = await db.sets.where({ workoutId }).filter((s) => s.exerciseId === item.exerciseId && s.kind === 'working').count();
    const next = await planItemFor({ ...item, exerciseId, incrementKg: undefined }, get);
    const plan = [...w.plan];
    if (logged > 0) {
      plan[index] = { ...item, sets: logged };
      plan.splice(index + 1, 0, next);
    } else {
      plan[index] = next;
    }
    await db.workouts.update(workoutId, { plan, updatedAt: Date.now() });
    return logged > 0 ? 'kept' : 'replaced';
  });
}

export async function logSet(
  workoutId: string,
  input: { exerciseId: string; kind: WorkoutSet['kind']; weightKg: number; reps: number; rir: number | null },
  restSec: number,
): Promise<WorkoutSet> {
  const now = Date.now();
  return db.transaction('rw', db.workouts, db.sets, async () => {
    const w = await db.workouts.get(workoutId);
    if (!w) throw new Error('找不到這場訓練');
    // 用最大 order + 1（取消中間某組後再記，順序也不會重複）
    const existing = await db.sets.where({ workoutId }).filter((s) => s.exerciseId === input.exerciseId).toArray();
    const count = existing.reduce((m, s) => Math.max(m, s.order + 1), 0);
    const set: WorkoutSet = {
      id: newId(),
      workoutId,
      date: w.date,
      exerciseId: input.exerciseId,
      order: count,
      kind: input.kind,
      weightKg: input.weightKg,
      reps: input.reps,
      rir: input.rir,
      completedAt: now,
      updatedAt: now,
    };
    await db.sets.put(set);
    await db.workouts.update(workoutId, { restEndsAt: restSec > 0 ? now + restSec * 1000 : null, restStartedAt: now, updatedAt: now });
    return set;
  });
}

export async function updateSet(id: string, patch: Partial<Pick<WorkoutSet, 'weightKg' | 'reps' | 'rir' | 'kind'>>) {
  await db.sets.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteSet(id: string): Promise<WorkoutSet | undefined> {
  const s = await db.sets.get(id);
  if (s) await db.sets.delete(id);
  return s;
}

export async function restoreSet(s: WorkoutSet) {
  await db.sets.put(s);
}

export async function setRestEndsAt(workoutId: string, restEndsAt: number | null) {
  await db.workouts.update(workoutId, { restEndsAt, updatedAt: Date.now() });
}

export async function discardWorkout(workoutId: string) {
  await db.transaction('rw', db.workouts, db.sets, async () => {
    await db.sets.where({ workoutId }).delete();
    await db.workouts.delete(workoutId);
  });
}

/** 刪除歷史訓練，回傳可用來復原的資料 */
export async function deleteWorkout(workoutId: string): Promise<{ workout: Workout; sets: WorkoutSet[] } | null> {
  return db.transaction('rw', db.workouts, db.sets, async () => {
    const workout = await db.workouts.get(workoutId);
    if (!workout) return null;
    const sets = await db.sets.where({ workoutId }).toArray();
    await db.sets.where({ workoutId }).delete();
    await db.workouts.delete(workoutId);
    return { workout, sets };
  });
}

export async function restoreWorkout(data: { workout: Workout; sets: WorkoutSet[] }) {
  await db.transaction('rw', db.workouts, db.sets, async () => {
    await db.workouts.put(data.workout);
    await db.sets.bulkPut(data.sets);
  });
}

export interface FinishResult {
  prs: string[];
  messages: Array<{ exerciseId: string; text: string }>;
}

/**
 * 完成訓練：對每個有進步規則的動作套用線性／雙重進步，更新下次工作重量；
 * 與先前紀錄比較找出 PR；推進課表到下一個訓練日。
 */
export async function finishWorkout(workoutId: string): Promise<FinishResult> {
  const settings = await getSettings();
  const get = await loadExerciseLookup();
  const bodyweight = await latestWeightKg();
  const w = await db.workouts.get(workoutId);
  if (!w) throw new Error('找不到這場訓練');
  // 已經完成過（例如連按兩次）就不要再套用一次進步規則
  if (w.status === 'done') return w.summary ?? { prs: [], messages: [] };
  const sets = (await db.sets.where({ workoutId }).toArray()).sort((a, b) => a.order - b.order);
  const result: FinishResult = { prs: [], messages: [] };
  const now = Date.now();
  // 磅制使用者以磅的級距計算（135 lb → 140 lb），存回資料庫時再換回公斤
  const lb = settings.units.weight === 'lb';
  const toU = (kg: number) => (lb ? kgToLb(kg) : kg);
  const fromU = (v: number) => (lb ? lbToKg(v) : v);
  const fmtW = (kg: number) => (lb ? `${fmt(kgToLb(kg))} lb` : `${fmt(kg)} kg`);

  await db.transaction('rw', [db.workouts, db.sets, db.progressionState, db.programs], async () => {
    const seen = new Set<string>();
    for (const item of w.plan) {
      if (seen.has(item.exerciseId)) continue;
      seen.add(item.exerciseId);
      const ex = get(item.exerciseId);
      const working = sets.filter((s) => s.exerciseId === item.exerciseId && s.kind === 'working');
      if (!working.length || item.progression === 'none' || !ex) continue;
      const state = await db.progressionState.get(item.exerciseId);
      const step = lb
        ? lbStepFor(ex.equipment, smallestPlateLb(settings))
        : roundingStepFor(ex.equipment, {
            smallestPlateKg: smallestPlateKg(settings),
            dumbbellStepKg: settings.equipment.dumbbellStepKg,
            machineStepKg: settings.equipment.machineStepKg,
          });
      const isBar = ex.equipment === 'barbell' || ex.equipment === 'smith' || ex.equipment === 'ezbar';
      // 減量後不低於空槓（EZ 槓用自己的槓重；磅制直接用 lb 槓重）
      const barU = lb && ex.equipment !== 'ezbar' ? settings.equipment.barLb : toU(barKgFor(settings, ex.equipment));
      const direction = ex.loadType === 'assisted' ? -1 : 1;
      const res = nextProgression(
        {
          sets: item.sets,
          repMin: item.repMin,
          repMax: item.repMax,
          progression: item.progression,
          incrementKg: ex.loadType === 'bodyweight' ? 0 : lb ? kgIncrementToLb(item.incrementKg) : item.incrementKg,
        },
        state ? { ...state, workingWeightKg: state.workingWeightKg == null ? null : toU(state.workingWeightKg) } : EMPTY_STATE,
        working.map((s) => ({ weightKg: toU(s.weightKg), reps: s.reps })),
        {
          failsBeforeDeload: settings.training.failsBeforeDeload,
          doubleFailsBeforeDeload: settings.training.doubleFailsBeforeDeload,
          deloadFactor: settings.training.deloadFactor,
        },
        step,
        { direction, minWeight: isBar && direction === 1 ? barU : undefined, unit: lb ? 'lb' : 'kg' },
      );
      if (res.outcome === 'skipped') continue;
      const text = res.suggestSwitch ? `${res.message} 這是第二次減量，可以考慮改用雙重進步或換到中階課表。` : res.message;
      await db.progressionState.put({
        exerciseId: item.exerciseId,
        workingWeightKg: res.state.workingWeightKg == null ? null : fromU(res.state.workingWeightKg),
        consecutiveFails: res.state.consecutiveFails,
        deloadCount: res.state.deloadCount,
        nextTargetReps: res.nextTargetReps,
        lastMessage: text,
        updatedAt: now,
      });
      result.messages.push({ exerciseId: item.exerciseId, text });
    }

    // PR：與這場之前的所有紀錄比較
    const exerciseIds = [...new Set(sets.map((s) => s.exerciseId))];
    for (const exId of exerciseIds) {
      const ex = get(exId);
      if (!ex) continue;
      const all = await db.sets.where('[exerciseId+date]').between([exId, Dexie.minKey], [exId, Dexie.maxKey]).toArray();
      const prior = all.filter((s) => s.workoutId !== workoutId && s.completedAt < w.startedAt);
      if (!prior.some((s) => s.kind === 'working')) continue;
      const opts = { formula: settings.training.e1rmFormula, useRir: settings.training.useRir, loadType: ex.loadType, bodyweightKg: bodyweight };
      const before = computePrs(prior as DatedSet[], opts);
      const now_ = computePrs(sets.filter((s) => s.exerciseId === exId) as DatedSet[], opts);
      if (now_.bestE1rm && (!before.bestE1rm || now_.bestE1rm.value > before.bestE1rm.value + 0.01)) {
        result.prs.push(`${ex.nameZh}：估計 1RM ${fmtW(now_.bestE1rm.value)}`);
        continue;
      }
      let repPr = false;
      for (const [reps, rec] of now_.repMaxes) {
        const prev = before.repMaxes.get(reps);
        if (prev && rec.weightKg > prev.weightKg) {
          result.prs.push(`${ex.nameZh}：${reps} 下最重 ${fmtW(rec.weightKg)}`);
          repPr = true;
          break;
        }
      }
      if (repPr) continue;
      // 第三種 PR：單次訓練量（Σ 負荷 × 次數）
      if (now_.bestSessionVolume && before.bestSessionVolume && now_.bestSessionVolume.value > before.bestSessionVolume.value + 0.5) {
        result.prs.push(`${ex.nameZh}：單次訓練量 ${fmtW(now_.bestSessionVolume.value)}`);
      }
    }

    // 推進課表
    if (w.programId && w.dayId) {
      const p = await db.programs.get(w.programId);
      if (p) {
        const idx = p.days.findIndex((d) => d.id === w.dayId);
        if (idx >= 0) await db.programs.update(p.id, { nextDayIndex: (idx + 1) % p.days.length, updatedAt: now });
      }
    }

    await db.workouts.update(workoutId, { status: 'done', endedAt: now, restEndsAt: null, summary: result, updatedAt: now });
  });
  return result;
}

// ---------- hooks ----------

export function useActiveWorkout(): Workout | null | undefined {
  return useLiveQuery(async () => (await db.workouts.where('status').equals('active').first()) ?? null, []);
}

export function useWorkout(id: string | undefined): Workout | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.workouts.get(id)) ?? null) : null), [id]);
}

export function useWorkoutSets(workoutId: string | undefined): WorkoutSet[] | undefined {
  return useLiveQuery(
    async () => (workoutId ? (await db.sets.where({ workoutId }).toArray()).sort((a, b) => a.order - b.order) : []),
    [workoutId],
  );
}

export function useDoneWorkouts(limit?: number): Workout[] | undefined {
  return useLiveQuery(async () => {
    const rows = await db.workouts.orderBy('date').reverse().filter((w) => w.status === 'done').toArray();
    rows.sort((a, b) => (b.date === a.date ? b.startedAt - a.startedAt : b.date.localeCompare(a.date)));
    return limit ? rows.slice(0, limit) : rows;
  }, [limit]);
}
