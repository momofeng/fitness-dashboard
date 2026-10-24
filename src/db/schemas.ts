// 每張表的 Zod schema，同時是 TypeScript 型別來源，也用來驗證匯入的備份。
// 慣例：一律存 kg / cm / kcal / ml；日期為本地 'YYYY-MM-DD'；每筆都有 updatedAt（毫秒）。

import { z } from 'zod';
import {
  EQUIPMENT,
  GOAL_TYPES,
  HABIT_RULES,
  LOAD_TYPES,
  MUSCLES,
  PHOTO_POSES,
  PRODUCT_CATEGORIES,
  PRODUCT_KINDS,
  PRODUCT_STATUSES,
  SORE_AREAS,
  SUPPLEMENT_CATEGORIES,
} from '../content/types';
import { isDateKey } from '../core/dates';
import { goalValueRange, LIMITS, PHOTO, type LimitKey } from './limits';

const dateKey = z.string().refine(isDateKey, { message: '日期格式須為 YYYY-MM-DD' });
const id = z.string().min(1).max(100);
const ts = z.number().int().nonnegative();
const kg = z.number().min(0).max(1000);
const nonneg = z.number().min(0);
/** 依 LIMITS 的範圍建立數字 schema */
const lim = (key: LimitKey) => z.number().min(LIMITS[key][0]).max(LIMITS[key][1]);
const limInt = (key: LimitKey) => z.number().int().min(LIMITS[key][0]).max(LIMITS[key][1]);

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
    /** 自適應 TDEE 套用後的值；null = 用公式（BMR × 活動係數） */
    tdeeOverride: lim('tdeeKcal').nullable(),
    tdeeAppliedAt: ts.nullable(),
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
    stallThresholdPct: lim('stallThresholdPct'),
    warmup: z.object({
      /** 空槓組的次數；0 = 不做空槓組 */
      barReps: limInt('warmupBarReps'),
      steps: z.array(z.object({ pct: lim('warmupPct'), reps: limInt('warmupReps') })).max(LIMITS.warmupSteps[1]),
    }),
  }),
  equipment: z.object({
    barKg: kg,
    plates: z.array(z.object({ kg: z.number().positive().max(50), pairs: z.number().int().min(0).max(20) })),
    dumbbellStepKg: z.number().positive().max(10),
    machineStepKg: z.number().positive().max(20),
    ezBarKg: lim('ezBarKg'),
    /** 磅制使用者的槓重與槓片 */
    barLb: lim('barLb'),
    platesLb: z.array(z.object({ lb: lim('plateLb'), pairs: limInt('platePairs') })),
  }),
  recovery: z.object({
    /** 近 7 天平均睡眠低於這個時數算恢復不足 */
    lowSleepH: lim('lowSleepH'),
    /** 近 7 天平均精力不高於這個值算恢復不足 */
    lowEnergy: lim('lowEnergy'),
    /** 減量週到哪一天（含）；null = 沒有進行中的減量週 */
    deloadUntil: dateKey.nullable(),
    deloadSetsPct: limInt('deloadSetsPct'),
    deloadWeightPct: lim('deloadWeightPct'),
  }),
  dayCutoffHour: z.number().int().min(0).max(6),
  weekStart: z.union([z.literal(0), z.literal(1)]),
  backup: z.object({
    lastExportAt: ts.nullable(),
    remindDays: z.number().int().min(0).max(90),
    /** 上次 ZIP 完整備份（含進度照） */
    lastFullExportAt: ts.nullable(),
  }),
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
  /** 覆寫課表的次數區間（兩個都有才生效） */
  repMin: z.number().int().min(1).max(100).optional(),
  repMax: z.number().int().min(1).max(100).optional(),
  updatedAt: ts,
}).refine((p) => p.repMin == null || p.repMax == null || p.repMin <= p.repMax, { message: '次數下限不能大於上限', path: ['repMin'] });
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
  /** 減量週的場次：不套用進步規則 */
  deload: z.boolean().optional(),
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
  sleepHours: lim('sleepH').optional(),
  energy: limInt('energy').optional(),
  soreness: z.array(z.enum(SORE_AREAS)).max(SORE_AREAS.length).optional(),
  steps: nonneg.max(200000).optional(),
  /** 飲食是否記完整（自適應 TDEE 用）；undefined = 依熱量自動判斷 */
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

// ---------- 選品 ----------

export const productSchema = z
  .object({
    id,
    kind: z.enum(PRODUCT_KINDS),
    name: z.string().min(1).max(60),
    brand: z.string().max(60),
    category: z.enum(PRODUCT_CATEGORIES),
    status: z.enum(PRODUCT_STATUSES),
    /** 每罐（每件）價格，新台幣 */
    price: lim('priceTwd').nullable(),
    servingsPerContainer: lim('servingsPerContainer').nullable(),
    servingLabel: z.string().max(30),
    proteinPerServingG: lim('proteinPerServingG').nullable(),
    dailyServings: lim('dailyServings').nullable(),
    /** 已買幾罐（補貨一次 +1） */
    containersBought: limInt('containers'),
    /** 庫存校正（份），例如開始用 App 前已經吃掉的份數記成負數 */
    adjustServings: lim('adjustServings'),
    remindDays: limInt('remindDays'),
    purchasedAt: dateKey.nullable(),
    note: z.string().max(500),
    createdAt: ts,
    updatedAt: ts,
  })
  .refine((p) => (p.kind === 'supplement') === (SUPPLEMENT_CATEGORIES as readonly string[]).includes(p.category), {
    message: '類別與種類不符',
    path: ['category'],
  });
export type Product = z.infer<typeof productSchema>;

/** 每個產品每天一筆，id = `${productId}:${date}` */
export const supplementLogSchema = z.object({
  id,
  productId: id,
  date: dateKey,
  servings: lim('logServings'),
  updatedAt: ts,
});
export type SupplementLog = z.infer<typeof supplementLogSchema>;

// ---------- 目標與習慣 ----------

const inGoalRange = (type: (typeof GOAL_TYPES)[number], v: number | null) => {
  if (v == null) return true;
  const [lo, hi] = goalValueRange(type);
  return Number.isFinite(v) && v >= lo && v <= hi;
};

export const goalSchema = z
  .object({
    id,
    type: z.enum(GOAL_TYPES),
    title: z.string().min(1).max(60),
    /** 動作目標 */
    exerciseId: id.nullable(),
    targetReps: limInt('targetReps').nullable(),
    /** 圍度目標 */
    circ: z.enum(CIRCUMFERENCES).nullable(),
    /** 自訂目標的單位 */
    unit: z.string().max(10),
    startValue: z.number().nullable(),
    targetValue: z.number(),
    /** 自訂目標手動更新的目前值 */
    current: z.number().nullable(),
    dueDate: dateKey.nullable(),
    status: z.enum(['active', 'done', 'archived']),
    doneAt: ts.nullable(),
    createdAt: ts,
    updatedAt: ts,
  })
  .superRefine((g, ctx) => {
    for (const k of ['startValue', 'targetValue', 'current'] as const) {
      if (!inGoalRange(g.type, g[k])) ctx.addIssue({ code: 'custom', message: '數值超出範圍', path: [k] });
    }
    if (g.type === 'lift' && (!g.exerciseId || g.targetReps == null)) ctx.addIssue({ code: 'custom', message: '動作目標需要動作與次數', path: ['exerciseId'] });
    if (g.type === 'circ' && !g.circ) ctx.addIssue({ code: 'custom', message: '圍度目標需要部位', path: ['circ'] });
  });
export type Goal = z.infer<typeof goalSchema>;

export const habitSchema = z.object({
  id,
  name: z.string().min(1).max(40),
  rule: z.enum(HABIT_RULES),
  perWeek: limInt('habitPerWeek'),
  archived: z.boolean(),
  order: z.number().int().min(0),
  createdAt: ts,
  updatedAt: ts,
});
export type Habit = z.infer<typeof habitSchema>;

/** 手動習慣的打卡，id = `${habitId}:${date}`；有這筆就是完成 */
export const habitLogSchema = z.object({ id, habitId: id, date: dateKey, updatedAt: ts });
export type HabitLog = z.infer<typeof habitLogSchema>;

// ---------- 進度照 ----------

/** 縮圖存在這張表（JSON 可序列化）；原圖 Blob 在 photoBlobs，只進 ZIP 備份 */
export const photoSchema = z.object({
  /** 會當成 ZIP 裡的檔名，只允許英數、底線、連字號 */
  id: id.regex(/^[A-Za-z0-9_-]+$/, { message: 'id 只能有英數字、底線或連字號' }),
  date: dateKey,
  pose: z.enum(PHOTO_POSES),
  note: z.string().max(200),
  width: limInt('photoPx'),
  height: limInt('photoPx'),
  bytes: limInt('photoBytes'),
  thumb: z
    .string()
    .max(PHOTO.thumbMaxChars)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/, { message: '縮圖格式錯誤' }),
  createdAt: ts,
  updatedAt: ts,
});
export type Photo = z.infer<typeof photoSchema>;
