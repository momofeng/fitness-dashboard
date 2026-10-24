import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { BodyMetric } from '../schemas';

/** 一天一筆：主鍵由日期決定，重複輸入同一天就是更新 */
export const bodyIdFor = (date: string) => `body:${date}`;

export async function upsertBodyMetric(date: string, patch: Partial<Omit<BodyMetric, 'id' | 'date' | 'updatedAt'>>) {
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
