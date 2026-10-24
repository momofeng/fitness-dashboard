// 獨立驗收找到的問題的回歸測試（2026-10-25）

import { beforeEach, describe, expect, it } from 'vitest';
import { exportBackup } from '../../src/db/backup/backup';
import { parseBackup } from '../../src/db/backup/import';
import { db } from '../../src/db/db';
import { defaultSettings } from '../../src/db/defaults';
import { LIMITS } from '../../src/db/limits';
import { moveBodyMetric, upsertBodyMetric } from '../../src/db/repo/body';
import { addWater } from '../../src/db/repo/foods';
import { activateTemplate } from '../../src/db/repo/programs';
import { updateSettings } from '../../src/db/repo/settings';
import {
  addExerciseToWorkout,
  finishWorkout,
  logSet,
  removePlanItem,
  restorePlanItem,
  startWorkout,
  swapPlanExercise,
  updatePlanItem,
} from '../../src/db/repo/workouts';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ ...defaultSettings(1), onboarded: true });
  await upsertBodyMetric('2026-10-01', { weightKg: 70 });
});

const work = (workoutId: string, exerciseId: string, weightKg: number, reps: number[]) =>
  reps.reduce<Promise<unknown>>((p, r) => p.then(() => logSet(workoutId, { exerciseId, kind: 'working', weightKg, reps: r, rir: null }, 0)), Promise.resolve());

describe('H1：存得進去的值，備份一定還原得回來', () => {
  it('邊界值寫入 → 匯出 → 匯入驗證通過', async () => {
    await upsertBodyMetric('2026-10-02', { weightKg: LIMITS.weightKg[0], bodyFatPct: LIMITS.bodyFatPct[0], circ: { waist: LIMITS.circCm[0] } });
    await upsertBodyMetric('2026-10-03', { weightKg: LIMITS.weightKg[1], bodyFatPct: LIMITS.bodyFatPct[1], circ: { waist: LIMITS.circCm[1] } });
    await addWater('2026-10-02', 999_999);
    const w = await startWorkout({});
    await addExerciseToWorkout(w, 'leg-press', 90);
    await updatePlanItem(w, 0, { sets: 999 });
    const parsed = parseBackup(JSON.stringify(await exportBackup(db, 'test')));
    expect(parsed.ok, JSON.stringify(!parsed.ok && parsed.issues)).toBe(true);
  });
  it.each([
    ['體重 0', { weightKg: 0 }],
    ['體重 450', { weightKg: 450 }],
    ['體脂 0', { bodyFatPct: 0 }],
    ['圍度 3 cm', { circ: { arm: 3 } }],
  ])('超出範圍直接拒絕寫入：%s', async (_n, patch) => {
    await expect(upsertBodyMetric('2026-10-05', patch)).rejects.toThrow(RangeError);
    expect(await db.bodyMetrics.get('body:2026-10-05')).toBeUndefined();
  });
  it('喝水與組數會被限制在範圍內', async () => {
    await addWater('2026-10-02', 30_000);
    expect((await db.dailyLogs.get('2026-10-02'))?.waterMl).toBe(LIMITS.waterMl[1]);
    await addWater('2026-10-02', -50_000);
    expect((await db.dailyLogs.get('2026-10-02'))?.waterMl).toBe(0);
  });
});

describe('H2：換動作／移除不會無聲刪掉已記錄的組', () => {
  it('已有紀錄時換動作 → 保留舊動作的組，新動作排在後面', async () => {
    await activateTemplate('novice-fullbody-barbell');
    const program = (await db.programs.where('isActive').equals(1).first())!;
    const w = await startWorkout({ program });
    await work(w, 'barbell-back-squat', 60, [6, 6]);
    expect(await swapPlanExercise(w, 0, 'leg-press')).toBe('kept');
    const plan = (await db.workouts.get(w))!.plan;
    expect(plan[0]).toMatchObject({ exerciseId: 'barbell-back-squat', sets: 2 });
    expect(plan[1]?.exerciseId).toBe('leg-press');
    expect(await db.sets.count()).toBe(2);
  });
  it('沒有紀錄時換動作 → 直接替換', async () => {
    const w = await startWorkout({});
    await addExerciseToWorkout(w, 'barbell-bench-press', 120);
    expect(await swapPlanExercise(w, 0, 'machine-chest-press')).toBe('replaced');
    expect((await db.workouts.get(w))!.plan.map((p) => p.exerciseId)).toEqual(['machine-chest-press']);
  });
  it('移除後可以復原（含已記錄的組）', async () => {
    const w = await startWorkout({});
    await addExerciseToWorkout(w, 'leg-press', 90);
    await addExerciseToWorkout(w, 'leg-extension', 90);
    await work(w, 'leg-press', 100, [10, 10]);
    const removed = await removePlanItem(w, 0);
    expect(await db.sets.count()).toBe(0);
    await restorePlanItem(w, removed!);
    expect((await db.workouts.get(w))!.plan.map((p) => p.exerciseId)).toEqual(['leg-press', 'leg-extension']);
    expect(await db.sets.count()).toBe(2);
  });
});

describe('進步規則接到完成訓練', () => {
  it('M2：輔助引體做到上限 → 輔助減少，且不誤報次數 PR', async () => {
    const w1 = await startWorkout({});
    await addExerciseToWorkout(w1, 'assisted-pull-up', 90);
    const max = (await db.workouts.get(w1))!.plan[0]!.repMax;
    await work(w1, 'assisted-pull-up', 20, [max, max, max]);
    await finishWorkout(w1);
    expect((await db.progressionState.get('assisted-pull-up'))?.workingWeightKg).toBeLessThan(20);

    // 輔助加多（變簡單）不算 PR
    const w2 = await startWorkout({});
    await addExerciseToWorkout(w2, 'assisted-pull-up', 90);
    await work(w2, 'assisted-pull-up', 30, [8, 8, 8]);
    const r = await finishWorkout(w2);
    expect(r.prs).toEqual([]);
  });
  it('M6：磅制 135 lb 達標 → 下次 140 lb', async () => {
    await updateSettings({ units: { weight: 'lb' } });
    await activateTemplate('novice-fullbody-barbell');
    const program = (await db.programs.where('isActive').equals(1).first())!;
    const w = await startWorkout({ program });
    const kg135 = 135 / 2.2046226218;
    await work(w, 'barbell-back-squat', kg135, [6, 6, 6]);
    const r = await finishWorkout(w);
    const st = await db.progressionState.get('barbell-back-squat');
    expect((st!.workingWeightKg! * 2.2046226218).toFixed(2)).toBe('140.00');
    expect(r.messages.find((m) => m.exerciseId === 'barbell-back-squat')?.text).toContain('140 lb');
  });
  it('L2：空槓連續失敗不會減到低於空槓', async () => {
    await db.progressionState.put({ exerciseId: 'barbell-overhead-press', workingWeightKg: 20, consecutiveFails: 2, deloadCount: 0, updatedAt: 1 });
    const w = await startWorkout({});
    await addExerciseToWorkout(w, 'barbell-overhead-press', 120);
    await updatePlanItem(w, 0, { progression: 'linear', repMin: 6, repMax: 6, sets: 3 });
    await work(w, 'barbell-overhead-press', 20, [3, 3, 3]);
    await finishWorkout(w);
    expect((await db.progressionState.get('barbell-overhead-press'))?.workingWeightKg).toBe(20);
  });
  it('M5：單次訓練量創新高也算 PR', async () => {
    const w1 = await startWorkout({});
    await addExerciseToWorkout(w1, 'leg-press', 90);
    await work(w1, 'leg-press', 100, [12, 12, 12]);
    await finishWorkout(w1);
    const w2 = await startWorkout({});
    await addExerciseToWorkout(w2, 'leg-press', 90);
    await updatePlanItem(w2, 0, { sets: 5 });
    await work(w2, 'leg-press', 100, [12, 12, 12, 12, 12]);
    const r = await finishWorkout(w2);
    expect(r.prs.some((p) => p.includes('單次訓練量'))).toBe(true);
  });
  it('L9：重複完成不會再套用一次進步規則（失敗次數不會被算兩次）', async () => {
    const w = await startWorkout({});
    await addExerciseToWorkout(w, 'dumbbell-curl', 90);
    const min = (await db.workouts.get(w))!.plan[0]!.repMin;
    await work(w, 'dumbbell-curl', 10, [min - 2, min - 2, min - 2]);
    await finishWorkout(w);
    await finishWorkout(w);
    expect((await db.progressionState.get('dumbbell-curl'))?.consecutiveFails).toBe(1);
  });
  it('L4：取消中間某組後再記，順序不重複', async () => {
    const w = await startWorkout({});
    await addExerciseToWorkout(w, 'leg-press', 90);
    await work(w, 'leg-press', 100, [10, 10, 10]);
    const all = await db.sets.toArray();
    await db.sets.delete(all.find((s) => s.order === 1)!.id);
    await work(w, 'leg-press', 105, [8]);
    const orders = (await db.sets.toArray()).map((s) => s.order).sort();
    expect(new Set(orders).size).toBe(orders.length);
  });
});

describe('M4：身體數據改日期是移動，不是複製', () => {
  it('舊日期刪除、新日期寫入', async () => {
    await upsertBodyMetric('2026-10-04', { weightKg: 71 });
    await moveBodyMetric('2026-10-04', '2026-10-06', { weightKg: 71, bodyFatPct: null, circ: {}, note: '' });
    expect(await db.bodyMetrics.get('body:2026-10-04')).toBeUndefined();
    expect((await db.bodyMetrics.get('body:2026-10-06'))?.weightKg).toBe(71);
  });
});
