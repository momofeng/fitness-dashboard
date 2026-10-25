// Round 2 獨立驗收找到的問題的回歸測試（2026-10-25）。

import { beforeEach, describe, expect, it } from 'vitest';
import { issueMessage, fieldLabel } from '../../src/db/backup/messages';
import { db } from '../../src/db/db';
import { defaultSettings } from '../../src/db/defaults';
import { isValidDay } from '../../src/db/limits';
import { upsertBodyMetric } from '../../src/db/repo/body';
import { addWater, quickAdd } from '../../src/db/repo/foods';
import { backfillGoalStart, saveGoal, saveHabit, toggleHabit, validateGoal } from '../../src/db/repo/goals';
import { addPhoto, updatePhotoMeta } from '../../src/db/repo/photos';
import { saveProduct, setCheckIn, validateProduct } from '../../src/db/repo/products';
import { setDailyRecovery } from '../../src/db/repo/recovery';

const THUMB = 'data:image/jpeg;base64,/9j/AAAA';
const BAD_DATES = ['0026-12-31', '20261-01-01', '', '2026-02-30', '1999-12-31'];

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ ...defaultSettings(1), onboarded: true });
});

describe('日期：存不進去不合法的日期（以前會讓備份整批還原不了）', () => {
  it('isValidDay', () => {
    expect(isValidDay('2026-10-25')).toBe(true);
    for (const d of BAD_DATES) expect(isValidDay(d), d).toBe(false);
  });

  it.each(BAD_DATES)('所有寫入路徑都拒絕「%s」', async (d) => {
    const goal = { type: 'bodyweight' as const, title: 'x', exerciseId: null, targetReps: null, circ: null, unit: '', startValue: null, targetValue: 75, current: null, dueDate: d };
    expect(validateGoal(goal)).toMatch(/期限/);
    const product = {
      kind: 'gear' as const, name: '腰帶', brand: '', category: 'belt' as const, status: 'using' as const, price: 1500, servingsPerContainer: null, servingLabel: '',
      proteinPerServingG: null, dailyServings: null, containersBought: 1, adjustServings: 0, remindDays: 0, purchasedAt: d, note: '',
    };
    expect(validateProduct(product)).toMatch(/購買日期/);
    const h = await saveHabit({ name: '伸展', rule: 'manual', perWeek: 7 });
    const p = await saveProduct({ ...product, purchasedAt: null });
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 1])], { type: 'image/jpeg' });
    const calls: Array<[string, () => Promise<unknown>]> = [
      ['toggleHabit', () => toggleHabit(h.id, d)],
      ['setCheckIn', () => setCheckIn(p.id, d, 1)],
      ['addPhoto', () => addPhoto({ date: d, pose: 'front', note: '', width: 10, height: 10, thumb: THUMB, blob })],
      ['setDailyRecovery', () => setDailyRecovery(d, { sleepHours: 7 })],
      ['upsertBodyMetric', () => upsertBodyMetric(d, { weightKg: 70 })],
      ['quickAdd', () => quickAdd({ date: d, meal: 'lunch', name: 'x', kcal: 500, protein: 20, fat: 10, carbs: 60 })],
      ['addWater', () => addWater(d, 250)],
    ];
    for (const [name, fn] of calls) await expect(fn(), name).rejects.toThrow(RangeError);
    const ok = await addPhoto({ date: '2026-10-01', pose: 'front', note: '', width: 10, height: 10, thumb: THUMB, blob });
    await expect(updatePhotoMeta(ok.id, { date: d })).rejects.toThrow(RangeError);
    expect((await db.photos.get(ok.id))!.date).toBe('2026-10-01');
  });
});

describe('目標：建立時還沒有資料', () => {
  it('第一次讀到資料就回填起點；超出範圍的值不回填', async () => {
    const g = await saveGoal({ type: 'bodyFat', title: '體脂 15%', exerciseId: null, targetReps: null, circ: null, unit: '', startValue: null, targetValue: 15, current: null, direction: 'down', dueDate: null });
    await backfillGoalStart(g.id, 0.5);
    expect((await db.goals.get(g.id))!.startValue).toBeNull();
    await backfillGoalStart(g.id, 20);
    expect((await db.goals.get(g.id))!.startValue).toBe(20);
    // 已有起點不覆蓋
    await backfillGoalStart(g.id, 18);
    expect((await db.goals.get(g.id))!.startValue).toBe(20);
  });
});

describe('還原錯誤訊息改成中文', () => {
  it.each([
    [{ code: 'too_big', message: 'Too big: expected number to be <=24', maximum: 24, origin: 'number' }, '超過上限 24'],
    [{ code: 'too_small', message: 'Too small', minimum: 1, origin: 'string' }, '太短（至少 1）'],
    [{ code: 'invalid_type', message: 'Invalid input: expected number, received string', expected: 'number' }, '格式錯誤（應為數字）'],
    [{ code: 'invalid_value', message: 'Invalid option' }, '不是允許的選項'],
    [{ code: 'custom', message: '日期格式須為 YYYY-MM-DD' }, '日期格式須為 YYYY-MM-DD'],
  ])('%j → %s', (iss, zh) => {
    expect(issueMessage(iss)).toBe(zh);
  });
  it('欄位名稱', () => {
    expect(fieldLabel('sleepHours')).toBe('睡眠時數');
    expect(fieldLabel('items.0.qty')).toBe('items › 第 1 項 › qty');
  });
});

describe('減量週：只在減量週做過的動作', () => {
  it('減量週內不再打折；減量結束後有目標重量可用', async () => {
    const { startDeloadWeek, endDeloadWeek } = await import('../../src/db/repo/recovery');
    const { addExerciseToWorkout, finishWorkout, logSet, startWorkout } = await import('../../src/db/repo/workouts');
    const { todayKey } = await import('../../src/core/dates');
    await startDeloadWeek(todayKey(4));
    const w1 = await startWorkout({});
    await addExerciseToWorkout(w1, 'leg-press', 90);
    for (let i = 0; i < 2; i++) await logSet(w1, { exerciseId: 'leg-press', kind: 'working', weightKg: 80, reps: 10, rir: null }, 0);
    await finishWorkout(w1);
    const w2 = await startWorkout({});
    await addExerciseToWorkout(w2, 'leg-press', 90);
    expect((await db.workouts.get(w2))!.plan[0]!.targetWeightKg).toBe(80);
    await finishWorkout(w2);
    await endDeloadWeek(todayKey(4));
    const w3 = await startWorkout({});
    await addExerciseToWorkout(w3, 'leg-press', 90);
    expect((await db.workouts.get(w3))!.plan[0]!.targetWeightKg).toBe(80);
  });
});
