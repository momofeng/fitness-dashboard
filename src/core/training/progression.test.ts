import { describe, expect, it } from 'vitest';
import { diffDays } from '../dates';
import {
  DEFAULT_PROGRESSION_PREFS as P,
  EMPTY_STATE,
  detectStall,
  nextProgression,
  roundingStepFor,
  type SlotTarget,
} from './progression';

const linear: SlotTarget = { sets: 3, repMin: 5, repMax: 5, progression: 'linear', incrementKg: 2.5 };
const double: SlotTarget = { sets: 3, repMin: 8, repMax: 12, progression: 'double', incrementKg: 2 };
const sets = (w: number, ...reps: number[]) => reps.map((r) => ({ weightKg: w, reps: r }));

describe('線性進步', () => {
  it.each([
    ['全部達標 → 加重', sets(60, 5, 5, 5), 'increase', 62.5, 0],
    ['多做也算達標', sets(60, 6, 5, 7), 'increase', 62.5, 0],
    ['有一組沒達標 → 維持', sets(60, 5, 5, 4), 'fail', 60, 1],
    ['組數不足 → 維持', sets(60, 5, 5), 'fail', 60, 1],
  ] as const)('%s', (_name, s, outcome, weight, fails) => {
    const r = nextProgression(linear, { ...EMPTY_STATE, workingWeightKg: 60 }, [...s], P, 2.5);
    expect(r.outcome).toBe(outcome);
    expect(r.state.workingWeightKg).toBe(weight);
    expect(r.state.consecutiveFails).toBe(fails);
  });

  it('連續 3 次失敗 → 減量 10% 並取到槓片倍數', () => {
    const r = nextProgression(linear, { workingWeightKg: 60, consecutiveFails: 2, deloadCount: 0 }, sets(60, 5, 4, 3), P, 2.5);
    expect(r.outcome).toBe('deload');
    expect(r.state).toEqual({ workingWeightKg: 52.5, consecutiveFails: 0, deloadCount: 1 });
    expect(r.suggestSwitch).toBe(false);
  });

  it('第 2 次減量時建議換進步方式', () => {
    const r = nextProgression(linear, { workingWeightKg: 60, consecutiveFails: 2, deloadCount: 1 }, sets(60, 3, 3, 3), P, 2.5);
    expect(r.suggestSwitch).toBe(true);
  });

  it('評估重量取最輕的一組（最後一組減重不算加重成功）', () => {
    const r = nextProgression(linear, EMPTY_STATE, [...sets(60, 5, 5), ...sets(50, 5)], P, 2.5);
    expect(r.state.workingWeightKg).toBe(52.5);
  });

  it('只看前 N 組，多做的組不影響', () => {
    const r = nextProgression(linear, EMPTY_STATE, [...sets(60, 5, 5, 5), ...sets(60, 2)], P, 2.5);
    expect(r.outcome).toBe('increase');
  });

  it('沒有正式組 → 跳過、狀態不變', () => {
    const state = { workingWeightKg: 60, consecutiveFails: 1, deloadCount: 0 };
    const r = nextProgression(linear, state, [], P, 2.5);
    expect(r.outcome).toBe('skipped');
    expect(r.state).toBe(state);
  });

  it('硬舉 +5 kg', () => {
    const r = nextProgression({ ...linear, incrementKg: 5 }, EMPTY_STATE, sets(100, 5, 5, 5), P, 2.5);
    expect(r.state.workingWeightKg).toBe(105);
  });

  it('不在級距上的重量，加重後對齊級距', () => {
    const r = nextProgression(linear, EMPTY_STATE, sets(61, 5, 5, 5), P, 2.5);
    expect(r.state.workingWeightKg).toBe(62.5);
  });
});

describe('雙重進步', () => {
  it('每組都到 repMax → 加重、次數回到 repMin', () => {
    const r = nextProgression(double, EMPTY_STATE, sets(20, 12, 12, 12), P, 2);
    expect(r.outcome).toBe('increase');
    expect(r.state.workingWeightKg).toBe(22);
    expect(r.nextTargetReps).toBe(8);
  });
  it('都在區間內 → 維持，目標 = 最少次數 + 1', () => {
    const r = nextProgression(double, EMPTY_STATE, sets(20, 10, 9, 9), P, 2);
    expect(r.outcome).toBe('hold');
    expect(r.state.workingWeightKg).toBe(20);
    expect(r.nextTargetReps).toBe(10);
  });
  it('低於 repMin 一次 → 維持；連續 2 次 → 減量', () => {
    const r1 = nextProgression(double, EMPTY_STATE, sets(20, 9, 7, 6), P, 2);
    expect(r1.outcome).toBe('fail');
    const r2 = nextProgression(double, r1.state, sets(20, 8, 7, 6), P, 2);
    expect(r2.outcome).toBe('deload');
    expect(r2.state.workingWeightKg).toBe(18);
  });
});

describe('不追蹤進步', () => {
  it('只記錄重量', () => {
    const r = nextProgression({ ...double, progression: 'none' }, EMPTY_STATE, sets(30, 10), P, 2.5);
    expect(r.outcome).toBe('recorded');
    expect(r.state.workingWeightKg).toBe(30);
  });
});

describe('重量級距', () => {
  const prefs = { smallestPlateKg: 1.25, dumbbellStepKg: 2, machineStepKg: 2.5 };
  it('依器材', () => {
    expect(roundingStepFor('barbell', prefs)).toBe(2.5);
    expect(roundingStepFor('dumbbell', prefs)).toBe(2);
    expect(roundingStepFor('cable', prefs)).toBe(2.5);
    expect(roundingStepFor('bodyweight', prefs)).toBe(1.25);
  });
});

describe('停滯偵測', () => {
  const opts = { sessions: 3, threshold: 1.01, minDays: 14 };
  it('連續 3 次沒超過先前最佳，且已 14 天以上 → 停滯', () => {
    const s = [
      { date: '2026-09-01', bestE1rm: 100 },
      { date: '2026-09-05', bestE1rm: 98 },
      { date: '2026-09-10', bestE1rm: 100.5 },
      { date: '2026-09-15', bestE1rm: 99 },
    ];
    expect(detectStall(s, '2026-09-16', opts, diffDays)).toEqual({ stalled: true, daysSincePr: 15 });
  });
  it('還在進步 → 不停滯', () => {
    const s = [
      { date: '2026-09-01', bestE1rm: 100 },
      { date: '2026-09-05', bestE1rm: 101 },
      { date: '2026-09-10', bestE1rm: 102 },
      { date: '2026-09-15', bestE1rm: 103 },
    ];
    expect(detectStall(s, '2026-09-16', opts, diffDays).stalled).toBe(false);
  });
  it('未滿 14 天 → 不停滯', () => {
    const s = [
      { date: '2026-09-10', bestE1rm: 100 },
      { date: '2026-09-11', bestE1rm: 99 },
      { date: '2026-09-12', bestE1rm: 99 },
      { date: '2026-09-13', bestE1rm: 99 },
    ];
    expect(detectStall(s, '2026-09-14', opts, diffDays).stalled).toBe(false);
  });
  it('資料不足', () => {
    expect(detectStall([{ date: '2026-09-01', bestE1rm: 100 }], '2026-10-01', opts, diffDays).stalled).toBe(false);
  });
});
