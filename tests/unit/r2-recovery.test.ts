// Round 2 恢復：摘要、減量建議、減量週的訓練計畫與完成。

import { beforeEach, describe, expect, it } from 'vitest';
import { deloadAdvice, deloadTarget, recoverySummary, type RecoverySummary } from '../../src/core/recovery';
import { db } from '../../src/db/db';
import { defaultSettings } from '../../src/db/defaults';
import { upsertBodyMetric } from '../../src/db/repo/body';
import { activateTemplate } from '../../src/db/repo/programs';
import { endDeloadWeek, isDeloadActive, recentlyDeloaded, setDailyRecovery, startDeloadWeek } from '../../src/db/repo/recovery';
import { addExerciseToWorkout, finishWorkout, logSet, startWorkout, updatePlanItem } from '../../src/db/repo/workouts';
import { addDays, todayKey } from '../../src/core/dates';

const P = { lowSleepH: 6, lowEnergy: 2 };
const sum = (p: Partial<RecoverySummary>): RecoverySummary => ({ loggedDays: 7, sleepAvg: 7.5, sleepDays: 7, energyAvg: 3.5, energyDays: 7, sore: [], ...p });

describe('recoverySummary', () => {
  it('只算視窗內（含今天往前 7 天）', () => {
    const s = recoverySummary(
      [
        { date: '2026-10-18', sleepHours: 2 }, // 視窗外
        { date: '2026-10-19', sleepHours: 6, energy: 2, soreness: ['quads'] },
        { date: '2026-10-25', sleepHours: 8, energy: 4, soreness: ['quads', 'glutes'] },
      ],
      '2026-10-25',
    );
    expect(s.sleepAvg).toBe(7);
    expect(s.sleepDays).toBe(2);
    expect(s.energyAvg).toBe(3);
    expect(s.sore[0]).toEqual({ area: 'quads', days: 2 });
  });
});

describe('deloadAdvice', () => {
  it('停滯＋睡眠不足 → 建議減量週', () => {
    const a = deloadAdvice({ stalled: ['槓鈴深蹲'], summary: sum({ sleepAvg: 5.4 }), weightTrend: 'ok' }, P);
    expect(a.level).toBe('deload');
    expect(a.offerDeload).toBe(true);
    expect(a.reasons.join()).toMatch(/槓鈴深蹲.*停滯/);
    expect(a.reasons.join()).toMatch(/5\.4/);
  });
  it('停滯＋精力低 → 建議減量週', () => {
    expect(deloadAdvice({ stalled: ['臥推'], summary: sum({ energyAvg: 2 }), weightTrend: null }, P).level).toBe('deload');
  });
  it('只有停滯、恢復正常 → 先看體重，再換次數範圍、退 10%', () => {
    const a = deloadAdvice({ stalled: ['臥推'], summary: sum({}), weightTrend: 'slow' }, P);
    expect(a.level).toBe('watch');
    expect(a.offerDeload).toBe(false);
    expect(a.actions[0]).toMatch(/多吃/);
    expect(a.actions.at(-1)).toMatch(/10%/);
  });
  it('停滯但恢復紀錄不足 4 天 → 提醒記錄，不建議減量', () => {
    const a = deloadAdvice({ stalled: ['臥推'], summary: sum({ sleepAvg: 4, sleepDays: 3, energyDays: 0, energyAvg: null }), weightTrend: null }, P);
    expect(a.level).toBe('watch');
    expect(a.actions.join()).toMatch(/記錄/);
  });
  it('只有恢復不足 → 注意，不建議減量週', () => {
    const a = deloadAdvice({ stalled: [], summary: sum({ sleepAvg: 5 }), weightTrend: null }, P);
    expect(a).toMatchObject({ level: 'watch', title: '恢復不足', offerDeload: false });
  });
  it('都正常 → ok', () => {
    expect(deloadAdvice({ stalled: [], summary: sum({}), weightTrend: 'ok' }, P).level).toBe('ok');
  });
});

describe('deloadTarget', () => {
  it.each([
    [3, 100, 2.5, 2, 90],
    [5, 61, 2.5, 3, 52.5],
    [1, 20, 2.5, 1, 17.5],
    [4, null, 2.5, 2, null],
  ])('%i 組 %s kg → %i 組 %s kg', (sets, w, step, s2, w2) => {
    expect(deloadTarget(sets, w, 60, 90, step)).toEqual({ sets: s2, weight: w2 });
  });
});

describe('減量週', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.settings.put({ ...defaultSettings(1), onboarded: true });
    await upsertBodyMetric('2026-10-01', { weightKg: 70 });
  });

  it('開始／結束與有效期間', async () => {
    const today = todayKey(4);
    await startDeloadWeek(today);
    const until = (await db.settings.get('app'))!.recovery.deloadUntil!;
    expect(isDeloadActive(until, today)).toBe(true);
    expect(isDeloadActive(until, '2999-01-01')).toBe(false);
    const prev = await endDeloadWeek(today);
    expect(prev).toBe(until);
    const after = (await db.settings.get('app'))!.recovery.deloadUntil;
    // 提前結束：結束日改成昨天，不再進行中，但 14 天內算「剛做過減量週」
    expect(after).toBe(addDays(today, -1));
    expect(isDeloadActive(after, today)).toBe(false);
    expect(recentlyDeloaded(after, today)).toBe(true);
    expect(recentlyDeloaded(after, addDays(today, 15))).toBe(false);
  });

  it('沒有進步狀態的動作：減量週連續幾場不會一直打折，結束後回到原本重量', async () => {
    const w0 = await startWorkout({});
    await addExerciseToWorkout(w0, 'leg-press', 90);
    await updatePlanItem(w0, 0, { progression: 'none' });
    for (let i = 0; i < 3; i++) await logSet(w0, { exerciseId: 'leg-press', kind: 'working', weightKg: 100, reps: 10, rir: null }, 0);
    await finishWorkout(w0);
    await startDeloadWeek(todayKey(4));
    for (let k = 0; k < 3; k++) {
      const w = await startWorkout({});
      await addExerciseToWorkout(w, 'leg-press', 90);
      const item = (await db.workouts.get(w))!.plan[0]!;
      expect(item.targetWeightKg).toBe(90);
      for (let i = 0; i < item.sets; i++) await logSet(w, { exerciseId: 'leg-press', kind: 'working', weightKg: item.targetWeightKg!, reps: 10, rir: null }, 0);
      await finishWorkout(w);
    }
    await endDeloadWeek(todayKey(4));
    const after = await startWorkout({});
    await addExerciseToWorkout(after, 'leg-press', 90);
    expect((await db.workouts.get(after))!.plan[0]!.targetWeightKg).toBe(100);
  });

  it('減量週開的訓練：組數與重量下降，完成後進步狀態不變', async () => {
    await activateTemplate('novice-fullbody-barbell');
    await db.progressionState.put({ exerciseId: 'barbell-back-squat', workingWeightKg: 80, consecutiveFails: 1, deloadCount: 0, updatedAt: 1 });
    await startDeloadWeek(todayKey(4));
    const program = (await db.programs.where('isActive').equals(1).first())!;
    const normalSets = program.days[0]!.slots.find((s) => s.exerciseId === 'barbell-back-squat')!.sets;
    const w = await startWorkout({ program, dayIndex: 0 });
    const workout = (await db.workouts.get(w))!;
    expect(workout.deload).toBe(true);
    const squat = workout.plan.find((p) => p.exerciseId === 'barbell-back-squat')!;
    expect(squat.sets).toBe(Math.max(1, Math.round(normalSets * 0.6)));
    // 80 × 90% = 72 → 往下對齊 2.5 kg → 70
    expect(squat.targetWeightKg).toBe(70);

    for (let i = 0; i < squat.sets; i++) await logSet(w, { exerciseId: 'barbell-back-squat', kind: 'working', weightKg: 70, reps: 3, rir: null }, 0);
    const r = await finishWorkout(w);
    expect(r.messages.find((m) => m.exerciseId === 'barbell-back-squat')?.text).toMatch(/減量週/);
    const st = (await db.progressionState.get('barbell-back-squat'))!;
    expect(st.workingWeightKg).toBe(80);
    expect(st.consecutiveFails).toBe(1);
  });

  it('減量週中途加的動作也減組數', async () => {
    await startDeloadWeek(todayKey(4));
    const w = await startWorkout({});
    await addExerciseToWorkout(w, 'leg-press', 90);
    expect((await db.workouts.get(w))!.plan[0]!.sets).toBe(2);
  });

  it('沒有減量週時照常', async () => {
    const w = await startWorkout({});
    expect((await db.workouts.get(w))!.deload).toBeUndefined();
  });

  it('恢復紀錄：清除欄位、痠痛去重排序', async () => {
    await setDailyRecovery('2026-10-02', { sleepHours: 7.3, energy: 4, soreness: ['quads', 'chest', 'quads'] });
    let row = (await db.dailyLogs.get('2026-10-02'))!;
    expect(row.sleepHours).toBe(7.25);
    expect(row.soreness).toEqual(['chest', 'quads']);
    await setDailyRecovery('2026-10-02', { sleepHours: null, soreness: [] });
    row = (await db.dailyLogs.get('2026-10-02'))!;
    expect(row.sleepHours).toBeUndefined();
    expect(row.soreness).toBeUndefined();
    expect(row.energy).toBe(4);
  });
});
