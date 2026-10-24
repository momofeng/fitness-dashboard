// 訓練流程整合測試：開始 → 記組 → 完成 → 進步狀態、PR、課表推進（fake-indexeddb）

import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db/db';
import { defaultSettings } from '../../src/db/defaults';
import { upsertBodyMetric } from '../../src/db/repo/body';
import { activateTemplate, getActiveProgram } from '../../src/db/repo/programs';
import { addExerciseToWorkout, deleteWorkout, finishWorkout, logSet, restoreWorkout, startWorkout } from '../../src/db/repo/workouts';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ ...defaultSettings(1), onboarded: true });
  await upsertBodyMetric('2026-10-01', { weightKg: 70 });
  await activateTemplate('novice-fullbody-barbell');
});

async function doSets(workoutId: string, exerciseId: string, weightKg: number, reps: number[]) {
  for (const r of reps) await logSet(workoutId, { exerciseId, kind: 'working', weightKg, reps: r, rir: null }, 0);
}

describe('訓練流程', () => {
  it('第一次訓練沒有目標重量；達標後下次加重，課表推進到 B', async () => {
    const program = (await getActiveProgram())!;
    const w1 = await startWorkout({ program });
    const workout1 = (await db.workouts.get(w1))!;
    expect(workout1.dayName).toBe('全身 A');
    expect(workout1.plan[0]).toMatchObject({ exerciseId: 'barbell-back-squat', targetWeightKg: null, targetReps: 6, sets: 3 });

    await logSet(w1, { exerciseId: 'barbell-back-squat', kind: 'warmup', weightKg: 20, reps: 10, rir: null }, 0);
    await doSets(w1, 'barbell-back-squat', 60, [6, 6, 6]);
    const res = await finishWorkout(w1);
    expect(res.messages.find((m) => m.exerciseId === 'barbell-back-squat')?.text).toContain('62.5');
    expect((await db.progressionState.get('barbell-back-squat'))?.workingWeightKg).toBe(62.5);
    expect((await db.workouts.get(w1))?.status).toBe('done');
    expect((await getActiveProgram())?.nextDayIndex).toBe(1);

    const w2 = await startWorkout({ program: (await getActiveProgram())! });
    expect((await db.workouts.get(w2))?.dayName).toBe('全身 B');
  });

  it('未達標維持重量；B 之後回到 A 並帶入上次的工作重量；新高記錄為 PR', async () => {
    let program = (await getActiveProgram())!;
    const a1 = await startWorkout({ program });
    await doSets(a1, 'barbell-back-squat', 60, [6, 6, 6]);
    await finishWorkout(a1);

    program = (await getActiveProgram())!;
    const b1 = await startWorkout({ program });
    await doSets(b1, 'barbell-deadlift', 80, [5, 5]);
    const bRes = await finishWorkout(b1);
    expect(bRes.messages.find((m) => m.exerciseId === 'barbell-deadlift')?.text).toContain('85');

    program = (await getActiveProgram())!;
    const a2 = await startWorkout({ program });
    const plan = (await db.workouts.get(a2))!.plan;
    expect(plan[0]).toMatchObject({ exerciseId: 'barbell-back-squat', targetWeightKg: 62.5 });

    await doSets(a2, 'barbell-back-squat', 62.5, [6, 6, 5]);
    const res = await finishWorkout(a2);
    const st = await db.progressionState.get('barbell-back-squat');
    expect(st).toMatchObject({ workingWeightKg: 62.5, consecutiveFails: 1 });
    expect(res.prs.some((p) => p.startsWith('槓鈴深蹲'))).toBe(true);
  });

  it('同一時間只會有一場進行中的訓練', async () => {
    const program = (await getActiveProgram())!;
    const a = await startWorkout({ program });
    const b = await startWorkout({ program });
    expect(b).toBe(a);
  });

  it('自由訓練可加入動作；雙重進步動作做到上限就加重', async () => {
    const w = await startWorkout({});
    await addExerciseToWorkout(w, 'dumbbell-curl', 90);
    const item = (await db.workouts.get(w))!.plan[0]!;
    expect(item).toMatchObject({ exerciseId: 'dumbbell-curl', progression: 'double' });
    await doSets(w, 'dumbbell-curl', 10, [item.repMax, item.repMax, item.repMax]);
    await finishWorkout(w);
    expect((await db.progressionState.get('dumbbell-curl'))?.workingWeightKg).toBe(12);
  });

  it('刪除訓練後可復原', async () => {
    const w = await startWorkout({});
    await addExerciseToWorkout(w, 'leg-press', 90);
    await doSets(w, 'leg-press', 100, [10]);
    await finishWorkout(w);
    const backup = await deleteWorkout(w);
    expect(await db.sets.count()).toBe(0);
    await restoreWorkout(backup!);
    expect(await db.sets.count()).toBe(1);
    expect((await db.workouts.get(w))?.status).toBe('done');
  });

  it('記組時設定休息結束時間', async () => {
    const w = await startWorkout({});
    const before = Date.now();
    await logSet(w, { exerciseId: 'leg-press', kind: 'working', weightKg: 100, reps: 10, rir: null }, 90);
    const rest = (await db.workouts.get(w))!.restEndsAt!;
    expect(rest).toBeGreaterThanOrEqual(before + 90_000);
  });
});
