import { describe, expect, it } from 'vitest';
import { checkFoods, expectedKcal, parseAmount, parseUnitWeight, sampleState, toOutputRows, toWide, type RawRow } from './checks';

const row = (id: string, item: string, unit: string | null, v: string | number | null, extra: Partial<RawRow> = {}): RawRow => ({
  整合編號: id,
  樣品名稱: `食物${id}`,
  俗名: '別名A,別名B',
  食品分類: '肉類',
  內容物描述: '樣品狀態:生,雞胸部位; 前處理描述:混合均勻打碎',
  分析項: item,
  含量單位: unit,
  每100克含量: v,
  ...extra,
});

function food(id: string, v: { kcal: number | null; p: number | null; f: number | null; c: number | null; fib?: number | null; water?: number; ash?: number }) {
  return [
    row(id, '修正熱量', 'kcal', v.kcal == null ? null : `   ${v.kcal}`),
    row(id, '熱量', 'kcal', '1'),
    row(id, '粗蛋白', 'g', v.p),
    row(id, '粗脂肪', 'g', v.f),
    row(id, '總碳水化合物', 'g', v.c),
    row(id, '膳食纖維', 'g', v.fib ?? null),
    row(id, '鈉', 'mg', '45'),
    row(id, '水分', 'g', String(v.water ?? 100 - (v.p ?? 0) - (v.f ?? 0) - (v.c ?? 0) - 1)),
    row(id, '灰分', 'g', String(v.ash ?? 1)),
    row(id, '鐵', 'mg', '0.5'),
  ];
}

describe('數值解析', () => {
  it('去空白、空白與「-」是缺值', () => {
    expect(parseAmount('   117')).toBe(117);
    expect(parseAmount('  0.3 ')).toBe(0.3);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('-')).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });
  it('無法解析就丟錯', () => expect(() => parseAmount('約 5')).toThrow());
  it('樣品狀態', () => expect(sampleState('樣品狀態:生,雞胸部位; 前處理描述:x')).toBe('生,雞胸部位'));
  it('每單位重', () => {
    expect(parseUnitWeight('121.0克')).toBe(121);
    expect(parseUnitWeight('0.0克')).toBeNull();
    expect(parseUnitWeight(null)).toBeNull();
  });
});

describe('長轉寬', () => {
  it('依整合編號合併，只取對照表中的分析項', () => {
    const w = toWide(food('A1', { kcal: 104, p: 22, f: 1, c: 0 }));
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ id: 'A1', state: '生,雞胸部位', values: { kcal: 104, protein: 22, fat: 1, carbs: 0, sodium: 45 } });
    expect(w[0]!.values.fiber).toBeUndefined();
  });
  it('單位不符直接失敗', () => {
    expect(() => toWide([row('A1', '鈉', 'g', '1')])).toThrow(/單位/);
  });
  it('同一分析項重複出現直接失敗', () => {
    expect(() => toWide([row('A1', '粗蛋白', 'g', '1'), row('A1', '粗蛋白', 'g', '2')])).toThrow(/重複/);
  });
});

describe('品質檢查', () => {
  it('修正熱量公式', () => {
    expect(expectedKcal({ protein: 10, fat: 5, carbs: 20, fiber: 4 })).toBe(40 + 64 + 8 + 45);
  });
  it('缺必要欄位的食物排除並列出', () => {
    const foods = toWide([...food('A1', { kcal: 104, p: 22, f: 1, c: 0 }), ...food('A2', { kcal: 50, p: null, f: 1, c: 10 })]);
    const r = checkFoods(foods);
    expect(r.kept).toBe(1);
    expect(r.excluded).toEqual([{ id: 'A2', name: '食物A2', missing: ['protein'] }]);
    expect(toOutputRows(foods)).toHaveLength(1);
  });
  it('熱量離群比例過高 → 失敗', () => {
    const rows = Array.from({ length: 20 }, (_, i) => food(`B${i}`, { kcal: i < 2 ? 500 : 97, p: 22, f: 1, c: 0 })).flat();
    const r = checkFoods(toWide(rows));
    expect(r.energy.outliers).toHaveLength(2);
    expect(r.errors.join()).toMatch(/熱量一致性/);
  });
  it('成分加總偏離太多 → 失敗（抓欄位錯位）', () => {
    const rows = Array.from({ length: 10 }, (_, i) => food(`C${i}`, { kcal: 97, p: 22, f: 1, c: 0, water: 20 })).flat();
    expect(checkFoods(toWide(rows)).errors.join()).toMatch(/成分加總/);
  });
});
