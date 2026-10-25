// 恢復：每日睡眠、精力、痠痛部位（存在 dailyLogs），以及減量週。

import { useLiveQuery } from 'dexie-react-hooks';
import { SORE_AREAS, type SoreArea } from '../../content/types';
import { addDays } from '../../core/dates';
import { db } from '../db';
import { assertDay, assertRange } from '../limits';
import type { DailyLog } from '../schemas';
import { updateSettings } from './settings';

export interface RecoveryPatch {
  /** null = 清除 */
  sleepHours?: number | null;
  energy?: number | null;
  soreness?: SoreArea[];
}

export async function setDailyRecovery(date: string, patch: RecoveryPatch) {
  assertDay(date);
  assertRange('sleepH', patch.sleepHours, '睡眠時數');
  assertRange('energy', patch.energy, '精力');
  if (patch.energy != null && !Number.isInteger(patch.energy)) throw new RangeError('精力必須是 1–5 的整數');
  if (patch.soreness && patch.soreness.some((a) => !SORE_AREAS.includes(a))) throw new RangeError('未知的痠痛部位');
  await db.transaction('rw', db.dailyLogs, async () => {
    const cur = await db.dailyLogs.get(date);
    const next: DailyLog = { ...(cur ?? { date, waterMl: 0 }), updatedAt: Date.now() };
    if (patch.sleepHours !== undefined) {
      if (patch.sleepHours === null) delete next.sleepHours;
      else next.sleepHours = Math.round(patch.sleepHours * 4) / 4;
    }
    if (patch.energy !== undefined) {
      if (patch.energy === null) delete next.energy;
      else next.energy = patch.energy;
    }
    if (patch.soreness !== undefined) {
      if (patch.soreness.length === 0) delete next.soreness;
      else next.soreness = [...new Set(patch.soreness)].sort((a, b) => SORE_AREAS.indexOf(a) - SORE_AREAS.indexOf(b));
    }
    await db.dailyLogs.put(next);
  });
}

/** 飲食記錄是否完整（自適應 TDEE 用）。undefined = 交給熱量自動判斷 */
export async function setIntakeComplete(date: string, value: boolean | undefined) {
  assertDay(date);
  await db.transaction('rw', db.dailyLogs, async () => {
    const cur = await db.dailyLogs.get(date);
    const next: DailyLog = { ...(cur ?? { date, waterMl: 0 }), updatedAt: Date.now() };
    if (value === undefined) delete next.intakeComplete;
    else next.intakeComplete = value;
    await db.dailyLogs.put(next);
  });
}

export function useDailyLogsRange(from: string, to: string): DailyLog[] | undefined {
  return useLiveQuery(() => db.dailyLogs.where('date').between(from, to, true, true).toArray(), [from, to]);
}

// ---------- 減量週 ----------

export const DELOAD_DAYS = 7;

/** 從今天起 7 天（含今天） */
export async function startDeloadWeek(today: string) {
  await updateSettings({ recovery: { deloadUntil: addDays(today, DELOAD_DAYS - 1) } });
}

/** 提前結束：結束日改成昨天（不是清空），之後 14 天內不會再建議減量週；回傳原本的結束日供復原 */
export async function endDeloadWeek(today: string): Promise<string | null> {
  const prev = (await db.settings.get('app'))?.recovery.deloadUntil ?? null;
  await updateSettings({ recovery: { deloadUntil: addDays(today, -1) } });
  return prev;
}

export async function restoreDeloadUntil(until: string | null) {
  await updateSettings({ recovery: { deloadUntil: until } });
}

/** 減量週結束後多少天內不再建議減量 */
export const DELOAD_COOLDOWN_DAYS = 14;

export function recentlyDeloaded(deloadUntil: string | null, today: string): boolean {
  return deloadUntil != null && deloadUntil < today && deloadUntil >= addDays(today, -DELOAD_COOLDOWN_DAYS);
}

export function isDeloadActive(deloadUntil: string | null, today: string): boolean {
  return deloadUntil != null && today <= deloadUntil;
}
