import { describe, expect, it } from 'vitest';
import { autoHabitDone, bestWeightForReps, daysLeft, EMPTY_DAY, goalProgress, heatLevel, monthGrid, weekCount } from './goals';

describe('goalProgress', () => {
  it.each([
    // start, target, current → pct, done
    [70, 75, 72.5, 0.5, false],
    [70, 75, 75, 1, true],
    [70, 75, 76, 1, true],
    [70, 75, 69, 0, false],
    [85, 80, 82.5, 0.5, false], // 腰圍往下
    [85, 80, 79, 1, true],
    [null, 100, 60, 0, false], // 沒有起點 → 從目前值開始
  ])('起點 %s → 目標 %s，目前 %s', (start, target, current, pct, done) => {
    const p = goalProgress(start, target, current);
    expect(p.pct).toBeCloseTo(pct);
    expect(p.done).toBe(done);
  });
  it('沒有目前值', () => {
    expect(goalProgress(70, 75, null)).toMatchObject({ pct: null, done: false, remaining: null });
  });
  it('剩餘', () => {
    expect(goalProgress(70, 75, 72).remaining).toBe(3);
    expect(goalProgress(85, 80, 83).direction).toBe('down');
  });
});

it('bestWeightForReps：只算正式組、次數要夠', () => {
  const sets = [
    { kind: 'working', weightKg: 100, reps: 3 },
    { kind: 'working', weightKg: 90, reps: 5 },
    { kind: 'warmup', weightKg: 95, reps: 5 },
    { kind: 'drop', weightKg: 95, reps: 8 },
    { kind: 'working', weightKg: 85, reps: 8 },
  ];
  expect(bestWeightForReps(sets, 5)).toBe(90);
  expect(bestWeightForReps(sets, 9)).toBeNull();
});

it('daysLeft', () => {
  expect(daysLeft('2026-11-01', '2026-10-25')).toBe(7);
  expect(daysLeft('2026-10-20', '2026-10-25')).toBe(-5);
  expect(daysLeft(null, '2026-10-25')).toBeNull();
});

describe('autoHabitDone', () => {
  const t = { proteinG: 130, waterMl: 3000 };
  it.each([
    ['weighIn', { weighed: true }, true],
    ['protein', { proteinG: 124 }, true],
    ['protein', { proteinG: 120 }, false],
    ['water', { waterMl: 3000 }, true],
    ['water', { waterMl: 2999 }, false],
    ['sleep', { sleepH: 7 }, true],
    ['sleep', { sleepH: 6.5 }, false],
    ['workout', { workout: true }, true],
    ['logFood', { foodLogged: true }, true],
    ['supplement', { supplement: true }, true],
    ['manual', { workout: true }, false],
  ])('%s %j → %s', (rule, patch, done) => {
    expect(autoHabitDone(rule, { ...EMPTY_DAY, ...patch }, t)).toBe(done);
  });
  it('沒有蛋白質目標時不算完成', () => {
    expect(autoHabitDone('protein', { ...EMPTY_DAY, proteinG: 200 }, { proteinG: null, waterMl: 0 })).toBe(false);
  });
});

it('weekCount：本週（週一起）', () => {
  const done = new Set(['2026-10-18', '2026-10-19', '2026-10-21', '2026-10-25']);
  // 2026-10-25 是週日；週一起算的本週是 10/19–10/25
  expect(weekCount(done, '2026-10-25', 1)).toBe(3);
  // 週日起算的本週只有 10/25
  expect(weekCount(done, '2026-10-25', 0)).toBe(1);
});

describe('monthGrid', () => {
  it('2026 年 10 月、週一起：10/1 是週四，前面空 3 格', () => {
    const g = monthGrid(2026, 10, 1);
    expect(g[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(g.flat().filter(Boolean)).toHaveLength(31);
    expect(g.every((r) => r.length === 7)).toBe(true);
  });
  it('週日起', () => {
    expect(monthGrid(2026, 10, 0)[0]!.slice(0, 5)).toEqual([null, null, null, null, '2026-10-01']);
  });
  it('閏年 2 月', () => {
    expect(monthGrid(2028, 2, 1).flat().filter(Boolean)).toHaveLength(29);
  });
});

it.each([
  ['training', null, 0],
  ['training', 0, 0],
  ['training', 5, 1],
  ['training', 10, 2],
  ['training', 16, 3],
  ['training', 21, 4],
  ['protein', 0.4, 1],
  ['protein', 0.95, 4],
  ['habits', 1 / 3, 1],
  ['habits', 0.5, 2],
  ['habits', 0.9, 3],
  ['habits', 1, 4],
  ['sleep', 4.5, 1],
  ['sleep', 6.5, 3],
  ['sleep', 8, 4],
] as const)('heatLevel %s %s → %i', (m, v, lv) => {
  expect(heatLevel(m, v)).toBe(lv);
});
