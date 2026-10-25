import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { assertDay, inRange } from '../limits';
import type { BodyMetric } from '../schemas';

/** 一天一筆：主鍵由日期決定，重複輸入同一天就是更新 */
export const bodyIdFor = (date: string) => `body:${date}`;

/** 寫入前檢查範圍，避免存進匯入時會被拒絕的值（匯入是一筆錯就整批拒絕） */
export function validateBodyPatch(patch: Partial<Omit<BodyMetric, 'id' | 'date' | 'updatedAt'>>): string | null {
  if (patch.weightKg != null && !inRange('weightKg', patch.weightKg)) return '體重超出合理範圍（20–400 kg）';
  if (patch.bodyFatPct != null && !inRange('bodyFatPct', patch.bodyFatPct)) return '體脂率超出合理範圍（2–70%）';
  for (const v of Object.values(patch.circ ?? {})) if (v != null && !inRange('circCm', v)) return '圍度超出合理範圍（5–300 cm）';
  return null;
}

export async function upsertBodyMetric(date: string, patch: Partial<Omit<BodyMetric, 'id' | 'date' | 'updatedAt'>>) {
  assertDay(date);
  const err = validateBodyPatch(patch);
  if (err) throw new RangeError(err);
  const id = bodyIdFor(date);
  await db.transaction('rw', db.bodyMetrics, async () => {
    const cur = await db.bodyMetrics.get(id);
    const next: BodyMetric = {
      id,
      date,
      weightKg: cur?.weightKg ?? null,
      bodyFatPct: cur?.bodyFatPct ?? null,
      circ: cur?.circ ?? {},
      note: cur?.note ?? '',
      ...patch,
      updatedAt: Date.now(),
    };
    await db.bodyMetrics.put(next);
  });
}

/** 把某天的紀錄移到另一天（目標日已有資料時，以移過去的欄位覆蓋） */
export async function moveBodyMetric(fromDate: string, toDate: string, patch: Partial<Omit<BodyMetric, 'id' | 'date' | 'updatedAt'>>) {
  await upsertBodyMetric(toDate, patch);
  if (fromDate !== toDate) await db.bodyMetrics.delete(bodyIdFor(fromDate));
}

export async function latestWeightKg(): Promise<number | null> {
  const rows = await db.bodyMetrics.orderBy('date').reverse().toArray();
  return rows.find((r) => r.weightKg != null)?.weightKg ?? null;
}

export async function latestBodyFat(): Promise<number | null> {
  const rows = await db.bodyMetrics.orderBy('date').reverse().toArray();
  return rows.find((r) => r.bodyFatPct != null)?.bodyFatPct ?? null;
}

export function useBodyMetrics(): BodyMetric[] | undefined {
  return useLiveQuery(() => db.bodyMetrics.orderBy('date').toArray(), []);
}

export function useLatestWeight(): number | null | undefined {
  return useLiveQuery(latestWeightKg, []);
}
