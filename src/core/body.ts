// 體重趨勢與身體組成。

import { addDays, diffDays, rangeKeys, type DateKey } from './dates';

export interface DatedValue {
  date: DateKey;
  value: number;
}

/** 同一天多筆取平均 */
export function dailyAverages(entries: DatedValue[]): Map<DateKey, number> {
  const acc = new Map<DateKey, { sum: number; n: number }>();
  for (const e of entries) {
    if (!Number.isFinite(e.value)) continue;
    const a = acc.get(e.date) ?? { sum: 0, n: 0 };
    a.sum += e.value;
    a.n += 1;
    acc.set(e.date, a);
  }
  const out = new Map<DateKey, number>();
  for (const [k, a] of acc) out.set(k, a.sum / a.n);
  return out;
}

/**
 * endDate 往前 windowDays 天（含當天）的平均，只用窗內有資料的天數；
 * 有資料的天數少於 minCount 時回傳 null。
 */
export function movingAverage(
  daily: Map<DateKey, number>,
  endDate: DateKey,
  windowDays = 7,
  minCount = 4,
): number | null {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < windowDays; i++) {
    const v = daily.get(addDays(endDate, -i));
    if (v != null) {
      sum += v;
      n += 1;
    }
  }
  return n >= minCount ? sum / n : null;
}

/** 週增重率（%）：本週 7 日均對前週 7 日均 */
export function weeklyRatePct(daily: Map<DateKey, number>, today: DateKey): number | null {
  const now = movingAverage(daily, today);
  const prev = movingAverage(daily, addDays(today, -7));
  if (now == null || prev == null || prev === 0) return null;
  return ((now - prev) / prev) * 100;
}

export interface TrendPoint {
  date: DateKey;
  value: number | null;
  avg: number | null;
}

export function trendSeries(daily: Map<DateKey, number>, from: DateKey, to: DateKey): TrendPoint[] {
  return rangeKeys(from, to).map((date) => ({
    date,
    value: daily.get(date) ?? null,
    avg: movingAverage(daily, date),
  }));
}

export function latestValue(entries: DatedValue[]): DatedValue | null {
  let best: DatedValue | null = null;
  for (const e of entries) if (!best || e.date > best.date) best = e;
  return best;
}

export interface Ffmi {
  lbmKg: number;
  ffmi: number;
  normalized: number;
}

export function ffmi(weightKg: number, bodyFatPct: number, heightCm: number): Ffmi | null {
  if (!(weightKg > 0) || !(heightCm > 0) || !(bodyFatPct >= 0 && bodyFatPct < 100)) return null;
  const h = heightCm / 100;
  const lbmKg = weightKg * (1 - bodyFatPct / 100);
  const value = lbmKg / (h * h);
  return { lbmKg, ffmi: value, normalized: value + 6.1 * (1.8 - h) };
}

/**
 * 連續紀錄天數：從今天往回數；今天還沒記錄不算中斷，從昨天開始數。
 */
export function streak(activeDays: Set<DateKey>, today: DateKey): number {
  let day = activeDays.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (activeDays.has(day)) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}

export function daysSince(date: DateKey | null, today: DateKey): number | null {
  return date ? diffDays(date, today) : null;
}
