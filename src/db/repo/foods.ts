// 飲食紀錄的讀寫。每筆紀錄存營養快照（per），之後改食物或資料庫改版都不影響歷史。

import { useLiveQuery } from 'dexie-react-hooks';
import { barcodeVariants, normalizeBarcode } from '../../core/barcode';
import { portionFactor, scaleNutrients } from '../../core/nutrition';
import { db, newId } from '../db';
import { clampTo } from '../limits';
import type { CustomFood, DailyLog, FoodLog, Meal, MealTemplate, PerNutrients } from '../schemas';

/** 搜尋與記錄用的統一食物格式（衛福部、自建、餐點組合） */
export interface FoodItem {
  key: string;
  name: string;
  aliases: string[];
  sub: string;
  per: PerNutrients;
  servingG: number | null;
  servingLabel: string;
  source: 'tfda' | 'custom';
  rank?: number;
}

export function customToItem(f: CustomFood): FoodItem {
  return {
    key: `custom:${f.id}`,
    name: f.name,
    aliases: f.brand ? [f.brand] : [],
    sub: [f.brand, f.per.basis === 'perServing' ? `每${f.servingLabel || '份'}` : '每 100 g'].filter(Boolean).join(' · '),
    per: f.per,
    servingG: f.servingG,
    servingLabel: f.servingLabel,
    source: 'custom',
  };
}

export function computeEntry(per: PerNutrients, qty: number, unit: 'g' | 'serving', servingG: number | null) {
  const factor = portionFactor(per, qty, unit, servingG);
  if (factor == null) return null;
  return scaleNutrients(per, factor);
}

async function bumpUsage(foodKey: string, name: string, qty: number, unit: 'g' | 'serving') {
  const cur = await db.foodUsage.get(foodKey);
  await db.foodUsage.put({ foodKey, name, count: (cur?.count ?? 0) + 1, lastUsedAt: Date.now(), lastQty: qty, lastUnit: unit });
}

export async function addFoodLog(input: {
  date: string;
  meal: Meal;
  item: Pick<FoodItem, 'key' | 'name' | 'per' | 'servingG'>;
  qty: number;
  unit: 'g' | 'serving';
  source?: FoodLog['source'];
}): Promise<FoodLog> {
  const n = computeEntry(input.item.per, input.qty, input.unit, input.item.servingG);
  if (!n) throw new Error('這個份量無法換算，請改用克數或份數');
  const now = Date.now();
  const row: FoodLog = {
    id: newId(),
    date: input.date,
    meal: input.meal,
    foodKey: input.item.key,
    name: input.item.name,
    qty: input.qty,
    unit: input.unit,
    per: input.item.per,
    ...n,
    source: input.source ?? 'manual',
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction('rw', db.foodLogs, db.foodUsage, async () => {
    await db.foodLogs.put(row);
    await bumpUsage(input.item.key, input.item.name, input.qty, input.unit);
  });
  return row;
}

/** 改份量：依原本的倍數比例重算（單位不變） */
export async function updateFoodLogQty(id: string, qty: number) {
  const row = await db.foodLogs.get(id);
  if (!row || !(qty > 0)) return;
  const ratio = qty / row.qty;
  await db.foodLogs.update(id, {
    qty,
    kcal: row.kcal * ratio,
    protein: row.protein * ratio,
    fat: row.fat * ratio,
    carbs: row.carbs * ratio,
    fiber: row.fiber * ratio,
    sodium: row.sodium * ratio,
    updatedAt: Date.now(),
  });
}

export async function moveFoodLog(id: string, meal: Meal) {
  await db.foodLogs.update(id, { meal, updatedAt: Date.now() });
}

export async function deleteFoodLog(id: string): Promise<FoodLog | undefined> {
  const row = await db.foodLogs.get(id);
  if (row) await db.foodLogs.delete(id);
  return row;
}

export async function restoreFoodLogs(rows: FoodLog[]) {
  await db.foodLogs.bulkPut(rows);
}

/** 快速加入：只填熱量與巨量（外食、便當） */
export async function quickAdd(input: { date: string; meal: Meal; name: string; kcal: number; protein: number; fat: number; carbs: number }) {
  const now = Date.now();
  const per: PerNutrients = { basis: 'perServing', kcal: input.kcal, protein: input.protein, fat: input.fat, carbs: input.carbs };
  await db.foodLogs.put({
    id: newId(),
    date: input.date,
    meal: input.meal,
    foodKey: null,
    name: input.name.trim() || '快速加入',
    qty: 1,
    unit: 'serving',
    per,
    kcal: input.kcal,
    protein: input.protein,
    fat: input.fat,
    carbs: input.carbs,
    fiber: 0,
    sodium: 0,
    source: 'quick',
    createdAt: now,
    updatedAt: now,
  });
}

/** 把某天（或某一餐）的紀錄複製到另一天 */
export async function copyLogs(fromDate: string, toDate: string, meal?: Meal): Promise<number> {
  const src = await db.foodLogs.where('date').equals(fromDate).toArray();
  const rows = src.filter((r) => !meal || r.meal === meal);
  const now = Date.now();
  await db.foodLogs.bulkPut(rows.map((r, i) => ({ ...r, id: newId(), date: toDate, source: 'copy' as const, createdAt: now + i, updatedAt: now + i })));
  return rows.length;
}

export async function saveMealAsTemplate(date: string, meal: Meal, name: string): Promise<MealTemplate | null> {
  const rows = (await db.foodLogs.where('[date+meal]').equals([date, meal]).toArray()).sort((a, b) => a.createdAt - b.createdAt);
  if (!rows.length) return null;
  const t: MealTemplate = {
    id: newId(),
    name: name.trim() || '我的餐點',
    items: rows.map((r) => ({ foodKey: r.foodKey ?? `quick:${r.id}`, name: r.name, qty: r.qty, unit: r.unit, per: scaledPer(r) })),
    updatedAt: Date.now(),
  };
  await db.mealTemplates.put(t);
  return t;
}

/** 由紀錄反推「每單位」的營養（快速加入或份量換算過的都能還原） */
function scaledPer(r: FoodLog): PerNutrients {
  if (r.unit === 'serving') {
    return { basis: 'perServing', kcal: r.kcal / r.qty, protein: r.protein / r.qty, fat: r.fat / r.qty, carbs: r.carbs / r.qty, fiber: r.fiber / r.qty, sodium: r.sodium / r.qty };
  }
  const f = 100 / r.qty;
  return { basis: 'per100g', kcal: r.kcal * f, protein: r.protein * f, fat: r.fat * f, carbs: r.carbs * f, fiber: r.fiber * f, sodium: r.sodium * f };
}

export async function logMealTemplate(t: MealTemplate, date: string, meal: Meal, multiplier = 1) {
  const now = Date.now();
  const rows: FoodLog[] = t.items.map((it, i) => {
    const qty = it.qty * multiplier;
    const factor = it.per.basis === 'per100g' ? (it.unit === 'g' ? qty / 100 : qty) : qty;
    const n = scaleNutrients(it.per, factor);
    return {
      id: newId(),
      date,
      meal,
      foodKey: it.foodKey.startsWith('quick:') ? null : it.foodKey,
      name: it.name,
      qty,
      unit: it.unit,
      per: it.per,
      ...n,
      source: 'meal',
      createdAt: now + i,
      updatedAt: now + i,
    };
  });
  await db.transaction('rw', db.foodLogs, db.foodUsage, async () => {
    await db.foodLogs.bulkPut(rows);
    await bumpUsage(`meal:${t.id}`, t.name, multiplier, 'serving');
  });
}

export async function saveCustomFood(f: Omit<CustomFood, 'id' | 'updatedAt'> & { id?: string }): Promise<CustomFood> {
  const barcode = normalizeBarcode(f.barcode);
  if (barcode && !/^\d{8,14}$/.test(barcode)) throw new RangeError('條碼必須是 8–14 位數字');
  const row: CustomFood = { ...f, barcode, id: f.id ?? newId(), updatedAt: Date.now() };
  await db.foodsCustom.put(row);
  return row;
}

/** 依條碼找自建食物（UPC-A 與補 0 的 EAN-13 視為同一個） */
export async function findFoodByBarcode(code: string): Promise<CustomFood | undefined> {
  const n = normalizeBarcode(code);
  if (!n) return undefined;
  return db.foodsCustom.where('barcode').anyOf(barcodeVariants(n)).first();
}

export async function addWater(date: string, ml: number) {
  await db.transaction('rw', db.dailyLogs, async () => {
    const cur = await db.dailyLogs.get(date);
    const next: DailyLog = { ...(cur ?? { date, waterMl: 0 }), waterMl: clampTo('waterMl', (cur?.waterMl ?? 0) + ml), updatedAt: Date.now() };
    await db.dailyLogs.put(next);
  });
}

// ---------- hooks ----------

export function useFoodLogs(date: string): FoodLog[] | undefined {
  return useLiveQuery(async () => (await db.foodLogs.where('date').equals(date).toArray()).sort((a, b) => a.createdAt - b.createdAt), [date]);
}

export function useDailyLog(date: string): DailyLog | null | undefined {
  return useLiveQuery(async () => (await db.dailyLogs.get(date)) ?? null, [date]);
}
