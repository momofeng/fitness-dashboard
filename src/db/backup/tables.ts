// 備份涵蓋的表、各表主鍵與驗證 schema。photoBlobs 不進 JSON 備份（Round 2 的 ZIP 完整備份才含照片）。

import type { z } from 'zod';
import type { TableName } from '../db';
import {
  bodyMetricSchema,
  cardioSchema,
  customExerciseSchema,
  customFoodSchema,
  dailyLogSchema,
  exercisePrefSchema,
  foodLogSchema,
  foodUsageSchema,
  goalSchema,
  habitLogSchema,
  habitSchema,
  mealTemplateSchema,
  photoSchema,
  productSchema,
  programSchema,
  progressionStateSchema,
  setSchema,
  settingsSchema,
  supplementLogSchema,
  workoutSchema,
} from '../schemas';

export type BackupTable = Exclude<TableName, 'photoBlobs'>;

export interface TableSpec {
  key: string;
  /** 合併匯入時比較新舊的欄位 */
  stamp: string;
  schema: z.ZodType;
  label: string;
}

export const BACKUP_SPECS: Record<BackupTable, TableSpec> = {
  settings: { key: 'id', stamp: 'updatedAt', schema: settingsSchema, label: '設定' },
  exercisesCustom: { key: 'id', stamp: 'updatedAt', schema: customExerciseSchema, label: '自建動作' },
  exercisePrefs: { key: 'exerciseId', stamp: 'updatedAt', schema: exercisePrefSchema, label: '動作備註' },
  programs: { key: 'id', stamp: 'updatedAt', schema: programSchema, label: '課表' },
  progressionState: { key: 'exerciseId', stamp: 'updatedAt', schema: progressionStateSchema, label: '進步狀態' },
  workouts: { key: 'id', stamp: 'updatedAt', schema: workoutSchema, label: '訓練' },
  sets: { key: 'id', stamp: 'updatedAt', schema: setSchema, label: '組數' },
  cardio: { key: 'id', stamp: 'updatedAt', schema: cardioSchema, label: '有氧' },
  foodsCustom: { key: 'id', stamp: 'updatedAt', schema: customFoodSchema, label: '自建食物' },
  mealTemplates: { key: 'id', stamp: 'updatedAt', schema: mealTemplateSchema, label: '餐點組合' },
  foodLogs: { key: 'id', stamp: 'updatedAt', schema: foodLogSchema, label: '飲食紀錄' },
  foodUsage: { key: 'foodKey', stamp: 'lastUsedAt', schema: foodUsageSchema, label: '常用食物' },
  dailyLogs: { key: 'date', stamp: 'updatedAt', schema: dailyLogSchema, label: '每日紀錄' },
  bodyMetrics: { key: 'id', stamp: 'updatedAt', schema: bodyMetricSchema, label: '身體數據' },
  products: { key: 'id', stamp: 'updatedAt', schema: productSchema, label: '產品' },
  supplementLogs: { key: 'id', stamp: 'updatedAt', schema: supplementLogSchema, label: '補給品打卡' },
  goals: { key: 'id', stamp: 'updatedAt', schema: goalSchema, label: '目標' },
  habits: { key: 'id', stamp: 'updatedAt', schema: habitSchema, label: '習慣' },
  habitLogs: { key: 'id', stamp: 'updatedAt', schema: habitLogSchema, label: '習慣打卡' },
  photos: { key: 'id', stamp: 'updatedAt', schema: photoSchema, label: '進度照' },
};

export const BACKUP_TABLES = Object.keys(BACKUP_SPECS) as BackupTable[];
