// Round 2 訓練小待辦：暖身方案、停滯門檻、遞減組、EZ 槓、磅制級距、次數區間覆寫。

import { beforeEach, describe, expect, it } from 'vitest';
import { detectStall, lbStepFor } from '../../src/core/training/progression';
import { DEFAULT_WARMUP_SCHEME, warmupSets } from '../../src/core/training/strength';
import { diffDays } from '../../src/core/dates';
import { db } from '../../src/db/db';
import { defaultSettings } from '../../src/db/defaults';
import { upsertBodyMetric } from '../../src/db/repo/body';
import { saveExercisePref, validatePref } from '../../src/db/repo/exercises';
import { updateSettings } from '../../src/db/repo/settings';
import { addExerciseToWorkout, finishWorkout, logSet, startWorkout, updatePlanItem } from '../../src/db/repo/workouts';
import { plateSetup } from '../../src/features/workout/plates';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ ...defaultSettings(1), onboarded: true });
  await upsertBodyMetric('2026-10-01', { weightKg: 70 });
});

const log = (w: string, exerciseId: string, kind: 'working' | 'drop', weightKg: number, reps: number) => logSet(w, { exerciseId, kind, weightKg, reps, rir: null }, 0);

describe('暖身方案', () => {
  it('預設方案與 Round 1 結果相同', () => {
    expect(warmupSets(100, 20, 2.5)).toEqual(warmupSets(100, 20, 2.5, DEFAULT_WARMUP_SCHEME));
  });
  it('自訂：不做空槓、50%×5、75%×3（順序亂也會排好）', () => {
    expect(warmupSets(100, 20, 2.5, { barReps: 0, steps: [{ pct: 75, reps: 3 }, { pct: 50, reps: 5 }] })).toEqual([
      { weightKg: 50, reps: 5 },
      { weightKg: 75, reps: 3 },
    ]);
  });
  it('空槓次數可調', () => {
    expect(warmupSets(100, 20, 2.5, { barReps: 6, steps: [] })).toEqual([{ weightKg: 20, reps: 6 }]);
  });
  it('磅制：135 lb、45 lb 槓、5 lb 級距', () => {
    expect(warmupSets(135, 45, 5)).toEqual([
      { weightKg: 45, reps: 10 },
      { weightKg: 55, reps: 5 },
      { weightKg: 80, reps: 3 },
      { weightKg: 110, reps: 2 },
    ]);
  });
});

describe('停滯門檻', () => {
  const sessions = [
    { date: '2026-09-01', bestE1rm: 100 },
    { date: '2026-09-10', bestE1rm: 101.5 },
    { date: '2026-09-15', bestE1rm: 101.5 },
    { date: '2026-09-20', bestE1rm: 101.5 },
  ];
  it('門檻 1%：101.5 沒超過 100×1.01 以上 → 不算進步 → 停滯', () => {
    // 先前最佳是 9/1 的 100；最近三次 101.5 > 101 → 有進步
    expect(detectStall(sessions, '2026-10-01', { sessions: 3, threshold: 1.01, minDays: 14 }, diffDays).stalled).toBe(false);
  });
  it('門檻 2%：101.5 < 102 → 停滯', () => {
    expect(detectStall(sessions, '2026-10-01', { sessions: 3, threshold: 1.02, minDays: 14 }, diffDays).stalled).toBe(true);
  });
});

describe('磅制級距與槓片設定', () => {
  it('槓鈴類以最小 lb 槓片 ×2 為級距', () => {
    expect(lbStepFor('barbell')).toBe(5);
    expect(lbStepFor('barbell', 1.25)).toBe(2.5);
    expect(lbStepFor('dumbbell', 1.25)).toBe(5);
  });
  it('plateSetup：磅制用 lb 槓與槓片；EZ 槓用自己的重量', async () => {
    const s = { ...defaultSettings(1), units: { weight: 'lb' as const } };
    const lb = plateSetup(s);
    expect(lb.unit).toBe('lb');
    expect(lb.bar).toBe(45);
    expect(lb.stock[0]).toEqual({ kg: 45, pairs: 4 });
    expect(lb.toUnit(lb.fromUnit(135))).toBe(135);
    expect(plateSetup(defaultSettings(1), 'ezbar').bar).toBe(10);
    expect(plateSetup(s, 'ezbar').bar).toBe(22);
  });
});

describe('遞減組', () => {
  it('遞減組不影響進步判定：正式組全部達標 → 照樣加重', async () => {
    const w = await startWorkout({});
    await addExerciseToWorkout(w, 'leg-press', 90);
    await updatePlanItem(w, 0, { repMin: 10, repMax: 12, sets: 2, progression: 'double', targetWeightKg: 100 });
    await log(w, 'leg-press', 'working', 100, 12);
    await log(w, 'leg-press', 'working', 100, 12);
    await log(w, 'leg-press', 'drop', 70, 15);
    await finishWorkout(w);
    const st = await db.progressionState.get('leg-press');
    expect(st?.workingWeightKg).toBeGreaterThan(100);
    expect(st?.consecutiveFails).toBe(0);
  });
});

describe('EZ 槓', () => {
  it('減量不會低於 EZ 槓重', async () => {
    await updateSettings({ equipment: { ezBarKg: 10 } });
    await db.progressionState.put({ exerciseId: 'ez-bar-curl', workingWeightKg: 10, consecutiveFails: 2, deloadCount: 0, updatedAt: 1 });
    const w = await startWorkout({});
    await addExerciseToWorkout(w, 'ez-bar-curl', 90);
    await updatePlanItem(w, 0, { progression: 'linear', repMin: 10, repMax: 10, sets: 3 });
    for (let i = 0; i < 3; i++) await log(w, 'ez-bar-curl', 'working', 10, 5);
    await finishWorkout(w);
    expect((await db.progressionState.get('ez-bar-curl'))?.workingWeightKg).toBe(10);
  });
});

describe('次數區間覆寫', () => {
  it('動作頁設定的次數區間優先於課表', async () => {
    await saveExercisePref('dumbbell-curl', { repMin: 12, repMax: 15 });
    const w = await startWorkout({});
    await addExerciseToWorkout(w, 'dumbbell-curl', 90);
    const item = (await db.workouts.get(w))!.plan[0]!;
    expect([item.repMin, item.repMax]).toEqual([12, 15]);
    expect(item.targetReps).toBe(12);
  });
  it('清空後回到課表設定', async () => {
    await saveExercisePref('dumbbell-curl', { repMin: 12, repMax: 15 });
    await saveExercisePref('dumbbell-curl', { repMin: undefined, repMax: undefined });
    const pref = await db.exercisePrefs.get('dumbbell-curl');
    expect(pref && 'repMin' in pref).toBe(false);
  });
  it.each([
    [{ repMin: 15, repMax: 12 }, /下限/],
    [{ repMin: 0, repMax: 12 }, /1–100/],
    [{ repMin: 8.5, repMax: 12 }, /1–100/],
  ])('拒絕不合理的次數：%j', async (patch, msg) => {
    expect(validatePref(patch)).toMatch(msg);
    await expect(saveExercisePref('dumbbell-curl', patch)).rejects.toThrow(RangeError);
  });
});
