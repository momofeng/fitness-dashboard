// 每張表的 Zod schema，同時是 TypeScript 型別來源，也用來驗證匯入的備份。
// 慣例：一律存 kg / cm / kcal / ml；日期為本地 'YYYY-MM-DD'；每筆都有 updatedAt（毫秒）。

import { z } from 'zod';
import { EQUIPMENT, LOAD_TYPES, MUSCLES } from '../content/types';
import { isDateKey } from '../core/dates';
import { LIMITS } from './limits';

const dateKey = z.string().refine(isDateKey, { message: '日期格式須為 YYYY-MM-DD' });
const id = z.string().min(1).max(100);
const ts = z.number().int().nonnegative();
const kg = z.number().min(0).max(1000);
const nonneg = z.number().min(0);

// ---------- 設定 ----------

export const settingsSchema = z.object({
  id: z.literal('app'),
  onboarded: z.boolean(),
  disclaimerAcceptedAt: ts.nullable(),
  profile: z.object({
    name: z.string().max(40),
    sex: z.enum(['male', 'female']),
    birthYear: z.number().int().min(1900).max(2100),
    heightCm: z.number().min(LIMITS.heightCm[0]).max(LIMITS.heightCm[1]),
    activity: z.number().min(1.1).max(2.0),
    experience: z.enum(['novice', 'intermediate', 'advanced']),
  }),
  units: z.object({ weight: z.enum(['kg', 'lb']) }),
  theme: z.enum(['dark', 'light', 'system']),
  nutrition: z.object({
    mode: z.enum(['rate', 'surplus']),
    weeklyGainPct: z.number().min(0).max(1.5),
    surplusKcal: z.number().min(0).max(1500),
    proteinPerKg: z.number().min(1).max(3.5),
    fatPct: z.number().min(10).max(50),
    fatMinPerKg: z.number().min(0.3).max(2),
    waterTargetMl: z.number().min(0).max(10000),
  }),
  training: z.object({
    e1rmFormula: z.enum(['epley', 'brzycki']),
    useRir: z.boolean(),
    failsBeforeDeload: z.number().int().min(1).max(10),
    doubleFailsBeforeDeload: z.number().int().min(1).max(10),
    deloadFactor: z.number().min(0.5).max(1),
    stallSessions: z.number().int().min(2).max(10),
    stallMinDays: z.number().int().min(0).max(120),
    volumeMin: z.number().min(0).max(50),
    volumeMax: z.number().min(0).max(60),
    defaultRestSec: z.number().int().min(0).max(900),
    keepAwake: z.boolean(),
    sound: z.boolean(),
    vibrate: z.boolean(),
  }),
  equipment: z.object({
    barKg: kg,
    plates: z.array(z.object({ kg: z.number().positive().max(50), pairs: z.number().int().min(0).max(20) })),
    dumbbellStepKg: z.number().positive().max(10),
    machineStepKg: z.number().positive().max(20),
  }),
  dayCutoffHour: z.number().int().min(0).max(6),
  weekStart: z.union([z.literal(0), z.literal(1)]),
  backup: z.object({ lastExportAt: ts.nullable(), remindDays: z.number().int().min(0).max(90) }),
  ai: z.object({ enabled: z.boolean(), provider: z.string().nullable(), model: z.string().nullable() }),
  updatedAt: ts,
});
export type Settings = z.infer<typeof settingsSchema>;

// ---------- 訓練 ----------

const exerciseFields = {
  nameZh: z.string().min(1).max(60),
  aliases: z.array(z.string().max(60)),
  nameEn: z.string().max(80),
  primary: z.array(z.enum(MUSCLES)).min(1),
  secondary: z.array(z.enum(MUSCLES)),
  equipment: z.enum(EQUIPMENT),
  category: z.enum(['compound', 'isolation']),
  loadType: z.enum(LOAD_TYPES),
  defaultIncrementKg: z.number().min(0).max(20),
  defaultRepRange: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  cues: z.string().max(500),
};

export const customExerciseSchema = z.object({ id, ...exerciseFields, updatedAt: ts });
export type CustomExercise = z.infer<typeof customExerciseSchema>;

export const exercisePrefSchema = z.object({
  exerciseId: id,
  note: z.string().max(500).optional(),
  restSec: z.number().int().min(0).max(900).optional(),
  incrementKg: z.number().min(0).max(20).optional(),
  updatedAt: ts,
});
export type ExercisePref = z.infer<typeof exercisePrefSchema>;

const progressionKind = z.enum(['linear', 'double', 'none']);

export const slotSchema = z.object({
  exerciseId: id,
  sets: z.number().int().min(1).max(20),
  repMin: z.number().int().min(1).max(100),
  repMax: z.number().int().min(1).max(100),
  restSec: z.number().int().min(0).max(900),
  progression: progressionKind,
  incrementKg: z.number().min(0).max(20).optional(),
  supersetGroup: z.number().int().optional(),
  note: z.string().max(200).optional(),
});

export const programSchema = z.object({
  id,
  name: z.string().min(1).max(60),
  templateId: z.string().nullable(),
  /** IndexedDB 不能用布林值當索引，用 1 / 0 */
  isActive: z.union([z.literal(0), z.literal(1)]),
  daysPerWeek: z.number().int().min(1).max(7),
  days: z.array(z.object({ id, name: z.string().min(1).max(40), slots: z.array(slotSchema) })).min(1),
  nextDayIndex: z.number().int().min(0),
  createdAt: ts,
  updatedAt: ts,
});
export type Program = z.infer<typeof programSchema>;

export const progressionStateSchema = z.object({
  exerciseId: id,
  workingWeightKg: kg.nullable(),
  consecutiveFails: z.number().int().min(0),
  deloadCount: z.number().int().min(0),
  /** 雙重進步：下次每組的目標次數 */
  nextTargetReps: z.number().int().min(1).max(100).optional(),
  lastMessage: z.string().max(200).optional(),
  updatedAt: ts,
});
export type ProgressionStateRow = z.infer<typeof progressionStateSchema>;

/** 開始訓練時把當天課表快照存在 workout 上，之後改課表不影響這場 */
export const planItemSchema = z.object({
  exerciseId: id,
  sets: z.number().int().min(LIMITS.planSets[0]).max(LIMITS.planSets[1]),
  repMin: z.number().int().min(1).max(100),
  repMax: z.number().int().min(1).max(100),
  restSec: z.number().int().min(0).max(900),
  progression: progressionKind,
  incrementKg: z.number().min(0).max(20),
  targetWeightKg: kg.nullable(),
  targetReps: z.number().int().min(1).max(100),
  supersetGroup: z.number().int().optional(),
});
export type PlanItem = z.infer<typeof planItemSchema>;

export const workoutSchema = z.object({
  id,
  date: dateKey,
  status: z.enum(['active', 'done']),
  programId: z.string().nullable(),
  dayId: z.string().nullable(),
  dayName: z.string().max(40),
  plan: z.array(planItemSchema),
  startedAt: ts,
  endedAt: ts.nullable(),
  restEndsAt: ts.nullable(),
  restStartedAt: ts.nullable().optional(),
  notes: z.string().max(2000),
  /** 完成時算出的摘要，例如 PR 數 */
  summary: z
    .object({ prs: z.array(z.string()), messages: z.array(z.object({ exerciseId: id, text: z.string() })) })
    .nullable(),
  updatedAt: ts,
});
export type Workout = z.infer<typeof workoutSchema>;

export const setSchema = z.object({
  id,
  workoutId: id,
  date: dateKey,
  exerciseId: id,
  order: z.number().int().min(0),
  kind: z.enum(['warmup', 'working', 'drop']),
  weightKg: kg,
  reps: z.number().int().min(0).max(1000),
  rir: z.number().min(0).max(10).nullable(),
  completedAt: ts,
  updatedAt: ts,
});
export type WorkoutSet = z.infer<typeof setSchema>;

export const cardioSchema = z.object({
  id,
  date: dateKey,
  type: z.string().min(1).max(40),
  minutes: z.number().min(0).max(1440),
  distanceKm: nonneg.max(1000).nullable(),
  kcal: nonneg.max(10000).nullable(),
  note: z.string().max(500),
  updatedAt: ts,
});
export type Cardio = z.infer<typeof cardioSchema>;

// ---------- 飲食 ----------

const per = z.object({
  basis: z.enum(['per100g', 'perServing']),
  kcal: nonneg.max(10000),
  protein: nonneg.max(1000),
  fat: nonneg.max(1000),
  carbs: nonneg.max(1000),
  fiber: nonneg.max(1000).optional(),
  sodium: nonneg.max(100000).optional(),
});
export type PerNutrients = z.infer<typeof per>;

export const customFoodSchema = z.object({
  id,
  name: z.string().min(1).max(80),
  brand: z.string().max(60),
  barcode: z.string().max(40),
  servingG: nonneg.max(5000).nullable(),
  servingLabel: z.string().max(30),
  per,
  updatedAt: ts,
});
export type CustomFood = z.infer<typeof customFoodSchema>;

const qtyUnit = z.enum(['g', 'serving']);

export const mealTemplateSchema = z.object({
  id,
  name: z.string().min(1).max(60),
  items: z
    .array(z.object({ foodKey: z.string(), name: z.string().max(80), qty: z.number().positive(), unit: qtyUnit, per }))
    .min(1),
  updatedAt: ts,
});
export type MealTemplate = z.infer<typeof mealTemplateSchema>;

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack', 'pre', 'post'] as const;
export type Meal = (typeof MEALS)[number];
export const MEAL_LABEL: Record<Meal, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '點心',
  pre: '練前',
  post: '練後',
};

export const foodLogSchema = z.object({
  id,
  date: dateKey,
  meal: z.enum(MEALS),
  /** 快速加入沒有 foodKey */
  foodKey: z.string().nullable(),
  name: z.string().min(1).max(80),
  qty: z.number().positive().max(100000),
  unit: qtyUnit,
  /** 營養快照：記錄當下的基準值，之後改食物或資料庫改版都不影響歷史 */
  per,
  kcal: nonneg,
  protein: nonneg,
  fat: nonneg,
  carbs: nonneg,
  fiber: nonneg,
  sodium: nonneg,
  source: z.enum(['manual', 'quick', 'meal', 'copy', 'ai']),
  createdAt: ts,
  updatedAt: ts,
});
export type FoodLog = z.infer<typeof foodLogSchema>;

export const foodUsageSchema = z.object({
  foodKey: z.string(),
  name: z.string().max(80),
  count: z.number().int().min(0),
  lastUsedAt: ts,
  lastQty: z.number().positive(),
  lastUnit: qtyUnit,
});
export type FoodUsage = z.infer<typeof foodUsageSchema>;

export const dailyLogSchema = z.object({
  date: dateKey,
  waterMl: z.number().min(LIMITS.waterMl[0]).max(LIMITS.waterMl[1]),
  // Round 2：恢復模組
  sleepHours: nonneg.max(24).optional(),
  energy: z.number().int().min(1).max(5).optional(),
  steps: nonneg.max(200000).optional(),
  intakeComplete: z.boolean().optional(),
  updatedAt: ts,
});
export type DailyLog = z.infer<typeof dailyLogSchema>;

// ---------- 身體 ----------

export const CIRCUMFERENCES = ['neck', 'shoulder', 'chest', 'arm', 'waist', 'hip', 'thigh', 'calf'] as const;
export type Circumference = (typeof CIRCUMFERENCES)[number];
export const CIRC_LABEL: Record<Circumference, string> = {
  neck: '頸圍',
  shoulder: '肩寬圍',
  chest: '胸圍',
  arm: '上臂圍',
  waist: '腰圍',
  hip: '臀圍',
  thigh: '大腿圍',
  calf: '小腿圍',
};

export const bodyMetricSchema = z.object({
  id,
  date: dateKey,
  weightKg: z.number().min(LIMITS.weightKg[0]).max(LIMITS.weightKg[1]).nullable(),
  bodyFatPct: z.number().min(LIMITS.bodyFatPct[0]).max(LIMITS.bodyFatPct[1]).nullable(),
  circ: z.partialRecord(z.enum(CIRCUMFERENCES), z.number().min(LIMITS.circCm[0]).max(LIMITS.circCm[1])),
  note: z.string().max(500),
  updatedAt: ts,
});
export type BodyMetric = z.infer<typeof bodyMetricSchema>;

// ---------- Round 2 預留（先寬鬆驗證：至少要有主鍵與 updatedAt） ----------

const reserved = z.looseObject({ id, updatedAt: ts });
export const productSchema = reserved;
export const supplementLogSchema = reserved;
export const goalSchema = reserved;
export const habitSchema = reserved;
export const habitLogSchema = reserved;
export const photoSchema = reserved;
