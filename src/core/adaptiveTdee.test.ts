import { describe, expect, it } from 'vitest';
import { LIMITS } from '../db/limits';
import { ADAPTIVE, adaptiveTdee, isEffectiveIntake, leastSquaresSlope, type IntakeDay } from './adaptiveTdee';
import { addDays } from './dates';
import { macroTargets } from './nutrition';

const TODAY = '2026-10-25';

/** 過去 21 天每天吃 kcal、體重每週變化 perWeek（kg） */
function data(opts: { kcal?: number; perWeek?: number; days?: number; noise?: (i: number) => number; intake?: (i: number, d: string) => Partial<IntakeDay> } = {}) {
  const { kcal = 2800, perWeek = 0.25, days = 21, noise = () => 0 } = opts;
  const intake: IntakeDay[] = [];
  const weights = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = addDays(TODAY, -days + i);
    intake.push({ date: d, kcal, entries: 5, ...opts.intake?.(i, d) });
    weights.set(d, 70 + (perWeek / 7) * i + noise(i));
  }
  return { intake, weights };
}

const base = { today: TODAY, targetKcal: 2800, lastAppliedDate: null };

describe('adaptiveTdee', () => {
  it('攝取 2800、每週 +0.25 kg → 估計 2525；目前 2600 → 建議 2525', () => {
    const r = adaptiveTdee({ ...base, ...data(), currentTdee: 2600 });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.estimate).toBeCloseTo(2525, 0);
    expect(r.slopeKgPerWeek).toBeCloseTo(0.25, 5);
    expect(r.suggestion).toBe(2525);
    expect(r.reason).toBe('apply');
  });

  it('差距超過 150 → 每次最多調 150', () => {
    const r = adaptiveTdee({ ...base, ...data(), currentTdee: 2300 });
    expect(r.status === 'ok' && r.suggestion).toBe(2450);
    const down = adaptiveTdee({ ...base, ...data(), currentTdee: 2900 });
    expect(down.status === 'ok' && down.suggestion).toBe(2750);
  });

  it('差距 < 50 不提示', () => {
    const r = adaptiveTdee({ ...base, ...data(), currentTdee: 2550 });
    expect(r).toMatchObject({ status: 'ok', suggestion: null, reason: 'small' });
  });

  it('套用後 7 天內不再建議', () => {
    const r = adaptiveTdee({ ...base, ...data(), currentTdee: 2300, lastAppliedDate: addDays(TODAY, -3) });
    expect(r).toMatchObject({ status: 'ok', suggestion: null, reason: 'cooldown', nextApplyDate: addDays(TODAY, 4) });
    const later = adaptiveTdee({ ...base, ...data(), currentTdee: 2300, lastAppliedDate: addDays(TODAY, -7) });
    expect(later.status === 'ok' && later.reason).toBe('apply');
  });

  it('有效攝取日不足 14 天 → 資料不足', () => {
    const r = adaptiveTdee({ ...base, ...data({ intake: (i) => (i < 8 ? { complete: false } : {}) }), currentTdee: 2600 });
    expect(r).toMatchObject({ status: 'insufficient', effectiveDays: 13 });
  });

  it('體重天數或跨度不足 → 資料不足', () => {
    const { intake } = data();
    const few = new Map([...data().weights].slice(0, 9));
    expect(adaptiveTdee({ ...base, intake, weights: few, currentTdee: 2600 }).status).toBe('insufficient');
    const short = new Map([...data().weights].slice(-12));
    const r = adaptiveTdee({ ...base, intake, weights: short, currentTdee: 2600 });
    expect(r).toMatchObject({ status: 'insufficient', weighDays: 12, weighSpanDays: 11 });
  });

  it('標記不完整的日子與熱量過低的日子不算', () => {
    // 前 5 天只記了 1200 kcal（沒標記）→ 低於目標 70% 自動排除；平均仍是 2800
    const r = adaptiveTdee({ ...base, ...data({ intake: (i) => (i < 5 ? { kcal: 1200 } : {}) }), currentTdee: 2600 });
    expect(r.status === 'ok' && r.meanIntake).toBe(2800);
    expect(r.status === 'ok' && r.effectiveDays).toBe(16);
    // 手動標「完整」的低熱量日要算進去
    const marked = adaptiveTdee({ ...base, ...data({ intake: (i) => (i === 0 ? { kcal: 1200, complete: true } : {}) }), currentTdee: 2600 });
    expect(marked.status === 'ok' && marked.meanIntake).toBeCloseTo((2800 * 20 + 1200) / 21);
  });

  it('今天的攝取不列入（通常還沒吃完）', () => {
    const { intake, weights } = data();
    intake.push({ date: TODAY, kcal: 500, entries: 1, complete: true });
    const r = adaptiveTdee({ ...base, intake, weights, currentTdee: 2600 });
    expect(r.status === 'ok' && r.meanIntake).toBe(2800);
  });

  it('體重每天有 ±0.4 kg 雜訊時，估計仍在 ±120 kcal 內', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 0.8 - 0.4;
    const r = adaptiveTdee({ ...base, ...data({ noise: () => rnd() }), currentTdee: 2600 });
    expect(r.status === 'ok' && Math.abs(r.estimate - 2525)).toBeLessThan(120);
  });

  it('上下限與 LIMITS 一致', () => {
    expect([ADAPTIVE.minKcal, ADAPTIVE.maxKcal]).toEqual(LIMITS.tdeeKcal);
  });
});

describe('輔助函式', () => {
  it('leastSquaresSlope', () => {
    expect(leastSquaresSlope([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }])).toBe(2);
    expect(leastSquaresSlope([{ x: 1, y: 1 }])).toBeNull();
    expect(leastSquaresSlope([{ x: 1, y: 1 }, { x: 1, y: 2 }])).toBeNull();
  });
  it('isEffectiveIntake', () => {
    expect(isEffectiveIntake({ date: TODAY, kcal: 2000, entries: 3 }, 2800)).toBe(true);
    expect(isEffectiveIntake({ date: TODAY, kcal: 1900, entries: 3 }, 2800)).toBe(false);
    expect(isEffectiveIntake({ date: TODAY, kcal: 0, entries: 0, complete: true }, 2800)).toBe(false);
  });
  it('macroTargets 使用 tdeeOverride，並保留公式值', () => {
    const input = { sex: 'male' as const, weightKg: 70, heightCm: 175, age: 30, activity: 1.55 };
    const prefs = { mode: 'surplus' as const, weeklyGainPct: 0.3, surplusKcal: 300, proteinPerKg: 1.8, fatPct: 25, fatMinPerKg: 0.6 };
    const formula = macroTargets(input, prefs);
    const adapted = macroTargets(input, { ...prefs, tdeeOverride: 2500 });
    expect(formula.tdeeSource).toBe('formula');
    expect(adapted).toMatchObject({ tdee: 2500, kcal: 2800, tdeeSource: 'adaptive', formulaTdee: formula.tdee });
  });
});
