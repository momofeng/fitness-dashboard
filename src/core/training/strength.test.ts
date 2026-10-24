import { describe, expect, it } from 'vitest';
import { computePrs, e1rm, effectiveLoad, plateLoadout, sessionBestE1rm, warmupSets, type DatedSet } from './strength';

const STOCK = [
  { kg: 25, pairs: 0 },
  { kg: 20, pairs: 4 },
  { kg: 15, pairs: 2 },
  { kg: 10, pairs: 2 },
  { kg: 5, pairs: 2 },
  { kg: 2.5, pairs: 2 },
  { kg: 1.25, pairs: 2 },
];

describe('e1RM', () => {
  it.each([
    [100, 5, 'epley', 116.6667],
    [100, 5, 'brzycki', 112.5],
    [80, 10, 'epley', 106.6667],
  ] as const)('%d kg × %d 下（%s）', (w, r, f, expected) => {
    expect(e1rm(w, r, f)).toBeCloseTo(expected, 3);
  });
  it('1 下直接取重量', () => {
    expect(e1rm(140, 1)).toBe(140);
    expect(e1rm(140, 1, 'brzycki')).toBe(140);
  });
  it('超過 12 下不計', () => {
    expect(e1rm(50, 13)).toBeNull();
    expect(e1rm(50, 12)).not.toBeNull();
  });
  it('使用 RIR：5 下 RIR 2 視同 7 下', () => {
    expect(e1rm(100, 5, 'epley', 2, true)).toBeCloseTo(100 * (1 + 7 / 30), 6);
    expect(e1rm(100, 5, 'epley', 2, false)).toBeCloseTo(100 * (1 + 5 / 30), 6);
    expect(e1rm(100, 11, 'epley', 2, true)).toBeNull();
  });
  it('無效輸入', () => {
    expect(e1rm(0, 5)).toBeNull();
    expect(e1rm(100, 0)).toBeNull();
  });
});

describe('自重負荷', () => {
  it('依負荷型態換算', () => {
    expect(effectiveLoad('external', 60, 70)).toBe(60);
    expect(effectiveLoad('bodyweightPlus', 10, 70)).toBe(80);
    expect(effectiveLoad('assisted', 30, 70)).toBe(40);
    expect(effectiveLoad('bodyweight', 0, 70)).toBe(70);
  });
});

describe('PR', () => {
  const sets: DatedSet[] = [
    { date: '2026-10-01', workoutId: 'w1', kind: 'warmup', weightKg: 100, reps: 5 },
    { date: '2026-10-01', workoutId: 'w1', kind: 'working', weightKg: 80, reps: 5 },
    { date: '2026-10-01', workoutId: 'w1', kind: 'working', weightKg: 80, reps: 5 },
    { date: '2026-10-03', workoutId: 'w2', kind: 'working', weightKg: 85, reps: 5 },
    { date: '2026-10-03', workoutId: 'w2', kind: 'working', weightKg: 70, reps: 8 },
    { date: '2026-10-05', workoutId: 'w3', kind: 'working', weightKg: 40, reps: 20 },
  ];
  const opts = { formula: 'epley' as const, useRir: false, loadType: 'external' as const, bodyweightKg: 70 };

  it('暖身組不算 PR', () => {
    const pr = computePrs(sets, opts);
    expect(pr.bestE1rm?.weightKg).toBe(85);
    expect(pr.bestE1rm?.value).toBeCloseTo(85 * (1 + 5 / 30), 6);
  });
  it('各次數最大重量；超過 12 下不列', () => {
    const pr = computePrs(sets, opts);
    expect(pr.repMaxes.get(5)).toEqual({ weightKg: 85, date: '2026-10-03' });
    expect(pr.repMaxes.get(8)).toEqual({ weightKg: 70, date: '2026-10-03' });
    expect(pr.repMaxes.has(20)).toBe(false);
  });
  it('單次訓練總量', () => {
    const pr = computePrs(sets, opts);
    // w2：85×5 + 70×8 = 985，大於 w3 的 40×20 = 800
    expect(pr.bestSessionVolume).toEqual({ value: 985, date: '2026-10-03' });
  });
  it('單場最佳 e1RM', () => {
    expect(sessionBestE1rm(sets.slice(0, 3), opts)).toBeCloseTo(80 * (1 + 5 / 30), 6);
    expect(sessionBestE1rm([], opts)).toBeNull();
  });
});

describe('槓片配重', () => {
  it('100 kg、20 kg 槓 → 每側 20+20', () => {
    const r = plateLoadout(100, 20, STOCK);
    expect(r.exact).toBe(true);
    expect(r.perSide).toEqual([20, 20]);
    expect(r.achievedKg).toBe(100);
  });
  it('62.5 kg → 每側 20 + 1.25', () => {
    const r = plateLoadout(62.5, 20, STOCK);
    expect(r.exact).toBe(true);
    expect(r.perSide.reduce((a, b) => a + b, 0)).toBeCloseTo(21.25, 6);
  });
  it('沒有 25 kg 時用 20+5', () => {
    const r = plateLoadout(70, 20, STOCK);
    expect(r.perSide).toEqual([20, 5]);
  });
  it('湊不出時給最接近的較低重量', () => {
    const r = plateLoadout(61, 20, STOCK);
    expect(r.exact).toBe(false);
    expect(r.achievedKg).toBe(60);
  });
  it('超過庫存上限', () => {
    const r = plateLoadout(400, 20, STOCK);
    expect(r.exact).toBe(false);
    expect(r.achievedKg).toBe(20 + 2 * (80 + 30 + 20 + 10 + 5 + 2.5));
  });
  it('低於槓重', () => {
    expect(plateLoadout(15, 20, STOCK)).toEqual({ perSide: [], achievedKg: 20, exact: false });
    expect(plateLoadout(20, 20, STOCK).exact).toBe(true);
  });
});

describe('暖身組', () => {
  it('100 kg：空槓×10、40×5、60×3、80×2', () => {
    expect(warmupSets(100, 20, 2.5)).toEqual([
      { weightKg: 20, reps: 10 },
      { weightKg: 40, reps: 5 },
      { weightKg: 60, reps: 3 },
      { weightKg: 80, reps: 2 },
    ]);
  });
  it('重量很輕時略過太接近的組', () => {
    const w = warmupSets(30, 20, 2.5);
    expect(w[0]).toEqual({ weightKg: 20, reps: 10 });
    expect(w.every((s) => s.weightKg < 30)).toBe(true);
    // 40%、60% 都低於空槓 → 被拉到 20，與空槓組相同而略過
    expect(w.filter((s) => s.weightKg === 20)).toHaveLength(1);
  });
  it('啞鈴（無槓）不排空槓組', () => {
    const w = warmupSets(20, 0, 2);
    expect(w.map((s) => s.weightKg)).toEqual([8, 12, 16]);
  });
  it('工作重量等於空槓時不需要暖身組', () => {
    expect(warmupSets(20, 20, 2.5)).toEqual([]);
  });
});
