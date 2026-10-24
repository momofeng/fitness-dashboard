// 熱量與巨量營養素計算。所有數字都是估算值，不是醫療建議。

import { clamp } from './units';

export type Sex = 'male' | 'female';

export const ACTIVITY_LEVELS = [
  { value: 1.2, label: '久坐', hint: '辦公室工作、幾乎不運動' },
  { value: 1.375, label: '輕度', hint: '每週訓練 1–3 天' },
  { value: 1.55, label: '中度', hint: '每週訓練 3–5 天' },
  { value: 1.725, label: '高度', hint: '每週訓練 6–7 天' },
  { value: 1.9, label: '極高', hint: '體力勞動工作＋每天訓練' },
] as const;

/** 每公斤體重變化約對應的熱量（kcal/kg） */
export const KCAL_PER_KG = 7700;

/** Mifflin-St Jeor */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export function tdee(bmrKcal: number, activity: number): number {
  return bmrKcal * activity;
}

/** 依目標週增重率（佔體重 %）換算每日盈餘，限制在 [150, 500] */
export function surplusFromRate(weightKg: number, weeklyGainPct: number): number {
  const kgPerWeek = (weightKg * weeklyGainPct) / 100;
  return clamp((kgPerWeek * KCAL_PER_KG) / 7, 150, 500);
}

export interface NutritionPrefs {
  mode: 'rate' | 'surplus';
  weeklyGainPct: number;
  surplusKcal: number;
  proteinPerKg: number;
  fatPct: number;
  fatMinPerKg: number;
}

export interface MacroTargets {
  tdee: number;
  surplus: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  warnings: string[];
}

const round5 = (g: number) => Math.round(g / 5) * 5;

export function macroTargets(
  input: { sex: Sex; weightKg: number; heightCm: number; age: number; activity: number },
  prefs: NutritionPrefs,
): MacroTargets {
  const t = tdee(bmr(input.sex, input.weightKg, input.heightCm, input.age), input.activity);
  const surplus =
    prefs.mode === 'rate' ? surplusFromRate(input.weightKg, prefs.weeklyGainPct) : prefs.surplusKcal;
  const kcal = Math.round(t + surplus);
  const protein = round5(prefs.proteinPerKg * input.weightKg);
  const fat = round5(Math.max((kcal * prefs.fatPct) / 100 / 9, prefs.fatMinPerKg * input.weightKg));
  const carbsRaw = (kcal - protein * 4 - fat * 9) / 4;
  const carbs = Math.max(0, round5(carbsRaw));
  const warnings: string[] = [];
  if (carbsRaw < 0) warnings.push('蛋白質與脂肪已超過目標熱量，請調低比例或提高熱量。');
  else if (carbs < 3 * input.weightKg) warnings.push('碳水低於每公斤 3 g，訓練表現可能受影響。');
  return { tdee: Math.round(t), surplus: Math.round(surplus), kcal, protein, fat, carbs, warnings };
}

export interface Nutrients {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber?: number;
  sodium?: number;
}

export const ZERO_NUTRIENTS: Required<Nutrients> = {
  kcal: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
  fiber: 0,
  sodium: 0,
};

/** 把「每 100 g」或「每份」的營養素換算成實際份量 */
export function scaleNutrients(per: Nutrients, factor: number): Required<Nutrients> {
  return {
    kcal: per.kcal * factor,
    protein: per.protein * factor,
    fat: per.fat * factor,
    carbs: per.carbs * factor,
    fiber: (per.fiber ?? 0) * factor,
    sodium: (per.sodium ?? 0) * factor,
  };
}

export function sumNutrients(items: Nutrients[]): Required<Nutrients> {
  const out = { ...ZERO_NUTRIENTS };
  for (const n of items) {
    out.kcal += n.kcal;
    out.protein += n.protein;
    out.fat += n.fat;
    out.carbs += n.carbs;
    out.fiber += n.fiber ?? 0;
    out.sodium += n.sodium ?? 0;
  }
  return out;
}

/** 由三大營養素推算熱量（Atwater 4/4/9） */
export function kcalFromMacros(p: number, c: number, f: number): number {
  return p * 4 + c * 4 + f * 9;
}
