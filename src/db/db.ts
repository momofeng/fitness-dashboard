// Dexie 資料庫。schemaVersion 直接等於 Dexie version，只維護一個數字。
// 升版規則：只新增表或索引，不改既有表的主鍵；資料轉換寫在 backup/migrate.ts 的純函式，
// Dexie upgrade 與舊備份匯入共用同一份。

import Dexie, { type EntityTable, type Table, type Transaction } from 'dexie';
import { MIGRATION_TABLES, MIGRATIONS } from './backup/migrate';
import type {
  AiMatch,
  BodyMetric,
  Cardio,
  CustomExercise,
  CustomFood,
  DailyLog,
  ExercisePref,
  FoodLog,
  FoodUsage,
  Goal,
  Habit,
  HabitLog,
  MealTemplate,
  Photo,
  Product,
  Program,
  ProgressionStateRow,
  Settings,
  SupplementLog,
  Workout,
  WorkoutSet,
} from './schemas';

/** 資料庫名稱要唯一：同一個 github.io 網域下的其他專案共用 origin */
export const DB_NAME = 'momofeng-fitness-dashboard';
export const SCHEMA_VERSION = 4;

export const STORES_V1 = {
  settings: 'id',
  exercisesCustom: 'id, nameZh',
  exercisePrefs: 'exerciseId',
  programs: 'id, isActive',
  progressionState: 'exerciseId',
  workouts: 'id, date, status',
  sets: 'id, workoutId, date, exerciseId, [exerciseId+date]',
  cardio: 'id, date',
  foodsCustom: 'id, name, barcode',
  mealTemplates: 'id, name',
  foodLogs: 'id, date, [date+meal]',
  foodUsage: 'foodKey, lastUsedAt',
  dailyLogs: 'date',
  bodyMetrics: 'id, date',
  // Round 2
  products: 'id, kind',
  supplementLogs: 'id, date, [productId+date]',
  goals: 'id, status',
  habits: 'id',
  habitLogs: 'id, [habitId+date]',
  photos: 'id, date',
  photoBlobs: 'id',
} as const;

/** v2：補 v1 計畫中漏掉的索引（自建動作依主要肌群、食物依使用次數），並加上 Round 2 查詢用的索引（只新增索引，不改主鍵） */
export const STORES_V2 = {
  ...STORES_V1,
  exercisesCustom: 'id, nameZh, *primary',
  foodUsage: 'foodKey, lastUsedAt, count',
  products: 'id, kind, status',
  habitLogs: 'id, date, [habitId+date]',
} as const;

/** v3：新增 aiMatches（AI 辨識名稱 → 你選定的食物）。只新增表，沒有資料轉換 */
export const STORES_V3 = {
  ...STORES_V2,
  aiMatches: 'norm, updatedAt',
} as const;

export type TableName = keyof typeof STORES_V3;

export interface PhotoBlob {
  id: string;
  blob: Blob;
}

/** Dexie upgrade：讀出受影響的表，套用與備份匯入相同的遷移函式後寫回 */
async function upgradeTables(tx: Transaction, from: number) {
  const names = MIGRATION_TABLES[from] ?? [];
  const tables: Record<string, unknown[]> = {};
  for (const n of names) tables[n] = await tx.table(n).toArray();
  const out = MIGRATIONS[from]!(tables);
  for (const n of names) {
    const rows = out[n] ?? [];
    if (rows.length) await tx.table(n).bulkPut(rows);
  }
}

export class FitnessDB extends Dexie {
  settings!: EntityTable<Settings, 'id'>;
  exercisesCustom!: EntityTable<CustomExercise, 'id'>;
  exercisePrefs!: EntityTable<ExercisePref, 'exerciseId'>;
  programs!: EntityTable<Program, 'id'>;
  progressionState!: EntityTable<ProgressionStateRow, 'exerciseId'>;
  workouts!: EntityTable<Workout, 'id'>;
  sets!: EntityTable<WorkoutSet, 'id'>;
  cardio!: EntityTable<Cardio, 'id'>;
  foodsCustom!: EntityTable<CustomFood, 'id'>;
  mealTemplates!: EntityTable<MealTemplate, 'id'>;
  foodLogs!: EntityTable<FoodLog, 'id'>;
  foodUsage!: EntityTable<FoodUsage, 'foodKey'>;
  dailyLogs!: EntityTable<DailyLog, 'date'>;
  bodyMetrics!: EntityTable<BodyMetric, 'id'>;
  products!: EntityTable<Product, 'id'>;
  supplementLogs!: EntityTable<SupplementLog, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  habits!: EntityTable<Habit, 'id'>;
  habitLogs!: EntityTable<HabitLog, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  photoBlobs!: Table<PhotoBlob, string>;
  aiMatches!: EntityTable<AiMatch, 'norm'>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores(STORES_V1);
    this.version(2)
      .stores(STORES_V2)
      .upgrade((tx) => upgradeTables(tx, 1));
    this.version(3).stores(STORES_V3);
    this.version(4).stores(STORES_V3).upgrade((tx) => upgradeTables(tx, 3));
  }
}

export const db = new FitnessDB();

/** 另一個分頁開了新版本時，關閉舊連線並請使用者重新整理 */
export function onVersionChange(handler: () => void) {
  db.on('versionchange', () => {
    db.close();
    handler();
    return false;
  });
}

export const newId = () => crypto.randomUUID();
export const now = () => Date.now();
