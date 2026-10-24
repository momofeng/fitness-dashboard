import { describe, expect, it } from 'vitest';
import { costPerGramProtein, costPerServing, daysLeft, gearCostPerSession, needsRestock, rankByValue, servingsBought, servingsLeft } from './products';

const whey = { servingsPerContainer: 30, containersBought: 2, adjustServings: -3, status: 'using' as const, dailyServings: 1, remindDays: 7 };

describe('庫存', () => {
  it('買進份數含校正', () => {
    expect(servingsBought(whey)).toBe(57);
    expect(servingsLeft(whey, 40)).toBe(17);
  });
  it('剩幾天', () => {
    expect(daysLeft(17, 1)).toBe(17);
    expect(daysLeft(17, 2)).toBe(8);
    expect(daysLeft(-3, 1)).toBe(0);
    expect(daysLeft(17, null)).toBeNull();
    expect(daysLeft(17, 0)).toBeNull();
  });
  it.each([
    [49, false], // 剩 8 天
    [50, true], // 剩 7 天
    [60, true], // 吃超過
  ])('已吃 %i 份 → 補貨提醒 %s', (consumed, expected) => {
    expect(needsRestock(whey, consumed)).toBe(expected);
  });
  it('考慮中、用完、沒設提醒都不提醒', () => {
    expect(needsRestock({ ...whey, status: 'candidate' }, 56)).toBe(false);
    expect(needsRestock({ ...whey, status: 'finished' }, 56)).toBe(false);
    expect(needsRestock({ ...whey, remindDays: 0 }, 56)).toBe(false);
    expect(needsRestock({ ...whey, dailyServings: null }, 56)).toBe(false);
  });
});

describe('成本', () => {
  it('每份與每克蛋白質', () => {
    expect(costPerServing(1200, 30)).toBe(40);
    // 1200 元 ÷（30 份 × 24 g）= 1.667 元／g
    expect(costPerGramProtein(1200, 30, 24)).toBeCloseTo(1.6667, 3);
    expect(costPerGramProtein(1200, 30, 0)).toBeNull();
    expect(costPerGramProtein(null, 30, 24)).toBeNull();
    expect(costPerServing(1200, null)).toBeNull();
  });
  it('依每克蛋白質成本排序，算不出來的排最後', () => {
    const r = rankByValue(
      [
        { id: 'a', price: 1200, servingsPerContainer: 30, proteinPerServingG: 24 },
        { id: 'b', price: null, servingsPerContainer: 30, proteinPerServingG: 24 },
        { id: 'c', price: 2400, servingsPerContainer: 80, proteinPerServingG: 25 },
      ],
      'protein',
    );
    expect(r.map((x) => x.id)).toEqual(['c', 'a', 'b']);
    expect(r[0]!.cost).toBeCloseTo(1.2);
  });
  it('裝備每次訓練成本', () => {
    expect(gearCostPerSession(1500, 30)).toBe(50);
    expect(gearCostPerSession(1500, 0)).toBeNull();
  });
});
