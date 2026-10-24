// Dexie 資料庫。schemaVersion 直接等於 Dexie version，只維護一個數字。
// 升版規則：只新增表或索引，不改既有表的主鍵；資料轉換寫在 backup/migrate.ts 的純函式，
// Dexie upgrade 與舊備份匯入共用同一份。

import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
  BodyMetric,
  Cardio,
  CustomExercise,
  CustomFood,
  DailyLog,
  ExercisePref,
  FoodLog,
  FoodUsage,
  MealTemplate,
  Program,
  ProgressionStateRow,
  Settings,
  Workout,
  WorkoutSet,
} from './schemas';

/** 資料庫名稱要唯一：同一個 github.io 網域下的其他專案共用 origin */
export const DB_NAME = 'momofeng-fitness-dashboard';
export const SCHEMA_VERSION = 1;

/** Round 2 預留表：結構之後再定，先只要求主鍵與 updatedAt */
export interface ReservedRow {
  id: string;
  updatedAt: number;
  [key: string]: unknown;
}

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

export type TableName = keyof typeof STORES_V1;

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
  products!: EntityTable<ReservedRow, 'id'>;
  supplementLogs!: EntityTable<ReservedRow, 'id'>;
  goals!: EntityTable<ReservedRow, 'id'>;
  habits!: EntityTable<ReservedRow, 'id'>;
  habitLogs!: EntityTable<ReservedRow, 'id'>;
  photos!: EntityTable<ReservedRow, 'id'>;
  photoBlobs!: Table<{ id: string; blob: Blob }, string>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores(STORES_V1);
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
