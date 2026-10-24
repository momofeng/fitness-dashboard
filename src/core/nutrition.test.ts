import { describe, expect, it } from 'vitest';
import { bmr, kcalFromMacros, macroTargets, portionFactor, scaleNutrients, sumNutrients, surplusFromRate, tdee } from './nutrition';

const prefs = {
  mode: 'rate' as const,
  weeklyGainPct: 0.3,
  surplusKcal: 300,
  proteinPerKg: 1.8,
  fatPct: 25,
  fatMinPerKg: 0.6,
};

describe('BMR / TDEE', () => {
  it('Mifflin-St Jeor 男 30 歲 175 cm 70 kg = 1648.75', () => {
    expect(bmr('male', 70, 175, 30)).toBeCloseTo(1648.75, 6);
  });
  it('女性 -161', () => {
    expect(bmr('female', 60, 165, 25)).toBeCloseTo(10 * 60 + 6.25 * 165 - 5 * 25 - 161, 6);
  });
  it('TDEE = BMR × 活動係數', () => {
    expect(tdee(1648.75, 1.55)).toBeCloseTo(2555.5625, 6);
  });
});

describe('熱量盈餘', () => {
  it('70 kg、每週 0.3% → 231 kcal', () => {
    expect(surplusFromRate(70, 0.3)).toBeCloseTo((70 * 0.003 * 7700) / 7, 6);
  });
  it('限制在 150–500', () => {
    expect(surplusFromRate(50, 0.1)).toBe(150);
    expect(surplusFromRate(120, 1)).toBe(500);
  });
});

describe('巨量營養素', () => {
  const input = { sex: 'male' as const, weightKg: 70, heightCm: 175, age: 30, activity: 1.55 };

  it('加總熱量與目標相差 ≤ 10 kcal（各項四捨五入到 5 g 的誤差上限），掃描多種體型', () => {
    for (const sex of ['male', 'female'] as const)
      for (let w = 40; w <= 120; w += 0.5)
        for (const activity of [1.2, 1.55, 1.9]) {
          const t = macroTargets({ ...input, sex, weightKg: w, activity }, prefs);
          if (t.carbs === 0) continue;
          expect(Math.abs(kcalFromMacros(t.protein, t.carbs, t.fat) - t.kcal), `${sex} ${w}kg ×${activity}`).toBeLessThanOrEqual(10);
        }
  });
  it('蛋白質 1.8 g/kg → 125 g（四捨五入到 5）', () => {
    expect(macroTargets(input, prefs).protein).toBe(125);
  });
  it('脂肪取熱量 25% 與 0.6 g/kg 的較大者', () => {
    const t = macroTargets(input, prefs);
    expect(t.fat).toBe(Math.round(Math.max((t.kcal * 0.25) / 9, 42) / 5) * 5);
  });
  it('直接指定盈餘', () => {
    const t = macroTargets(input, { ...prefs, mode: 'surplus', surplusKcal: 400 });
    expect(t.surplus).toBe(400);
    expect(t.kcal).toBe(Math.round(1648.75 * 1.55 + 400));
  });
  it('蛋白質＋脂肪超過熱量時碳水為 0 並警告', () => {
    const t = macroTargets(
      { sex: 'female', weightKg: 120, heightCm: 150, age: 80, activity: 1.2 },
      { ...prefs, mode: 'surplus', surplusKcal: 0, proteinPerKg: 3.5, fatPct: 50 },
    );
    expect(t.carbs).toBe(0);
    expect(t.warnings.length).toBeGreaterThan(0);
  });
});

describe('份量換算', () => {
  it('每 100 g × 1.5', () => {
    const n = scaleNutrients({ kcal: 100, protein: 20, fat: 2, carbs: 0 }, 1.5);
    expect(n).toEqual({ kcal: 150, protein: 30, fat: 3, carbs: 0, fiber: 0, sodium: 0 });
  });
  it('加總', () => {
    const s = sumNutrients([
      { kcal: 100, protein: 10, fat: 1, carbs: 5 },
      { kcal: 50, protein: 2, fat: 3, carbs: 1, sodium: 100 },
    ]);
    expect(s).toEqual({ kcal: 150, protein: 12, fat: 4, carbs: 6, fiber: 0, sodium: 100 });
  });
});

describe('份量倍數', () => {
  const p100 = { basis: 'per100g' as const, kcal: 165, protein: 31, fat: 3.6, carbs: 0 };
  const pServ = { basis: 'perServing' as const, kcal: 120, protein: 24, fat: 1.5, carbs: 3 };
  it('每 100 g × 克數', () => expect(portionFactor(p100, 150, 'g', null)).toBe(1.5));
  it('每 100 g × 份數（需知道一份幾克）', () => {
    expect(portionFactor(p100, 2, 'serving', 120)).toBe(2.4);
    expect(portionFactor(p100, 2, 'serving', null)).toBeNull();
  });
  it('每份 × 份數', () => expect(portionFactor(pServ, 1.5, 'serving', null)).toBe(1.5));
  it('每份 × 克數（需知道一份幾克）', () => {
    expect(portionFactor(pServ, 60, 'g', 30)).toBe(2);
    expect(portionFactor(pServ, 60, 'g', null)).toBeNull();
  });
  it('份量 0 或負數無效', () => expect(portionFactor(p100, 0, 'g', null)).toBeNull());
});
