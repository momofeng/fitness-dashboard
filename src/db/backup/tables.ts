// 備份涵蓋的表與各表主鍵（不含 Zod，匯出時不必載入驗證套件）。photoBlobs 不進 JSON 備份（Round 2 的 ZIP 完整備份才含照片）。

import type { TableName } from '../db';

export type BackupTable = Exclude<TableName, 'photoBlobs'>;

export interface TableSpec {
  key: string;
  /** 合併匯入時比較新舊的欄位 */
  stamp: string;
  label: string;
}

export const BACKUP_SPECS: Record<BackupTable, TableSpec> = {
  settings: { key: 'id', stamp: 'updatedAt', label: '設定' },
  exercisesCustom: { key: 'id', stamp: 'updatedAt', label: '自建動作' },
  exercisePrefs: { key: 'exerciseId', stamp: 'updatedAt', label: '動作備註' },
  programs: { key: 'id', stamp: 'updatedAt', label: '課表' },
  progressionState: { key: 'exerciseId', stamp: 'updatedAt', label: '進步狀態' },
  workouts: { key: 'id', stamp: 'updatedAt', label: '訓練' },
  sets: { key: 'id', stamp: 'updatedAt', label: '組數' },
  cardio: { key: 'id', stamp: 'updatedAt', label: '有氧' },
  foodsCustom: { key: 'id', stamp: 'updatedAt', label: '自建食物' },
  mealTemplates: { key: 'id', stamp: 'updatedAt', label: '餐點組合' },
  foodLogs: { key: 'id', stamp: 'updatedAt', label: '飲食紀錄' },
  foodUsage: { key: 'foodKey', stamp: 'lastUsedAt', label: '常用食物' },
  dailyLogs: { key: 'date', stamp: 'updatedAt', label: '每日紀錄' },
  bodyMetrics: { key: 'id', stamp: 'updatedAt', label: '身體數據' },
  products: { key: 'id', stamp: 'updatedAt', label: '產品' },
  supplementLogs: { key: 'id', stamp: 'updatedAt', label: '補給品打卡' },
  goals: { key: 'id', stamp: 'updatedAt', label: '目標' },
  habits: { key: 'id', stamp: 'updatedAt', label: '習慣' },
  habitLogs: { key: 'id', stamp: 'updatedAt', label: '習慣打卡' },
  photos: { key: 'id', stamp: 'updatedAt', label: '進度照' },
  aiMatches: { key: 'norm', stamp: 'updatedAt', label: 'AI 辨識對應' },
};

export const BACKUP_TABLES = Object.keys(BACKUP_SPECS) as BackupTable[];
