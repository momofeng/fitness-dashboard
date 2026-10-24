import { describe, expect, it } from 'vitest';
import { dailyAverages, ffmi, movingAverage, streak, trendSeries, weeklyRatePct } from './body';
import { addDays } from './dates';

const series = (start: string, values: Array<number | null>) =>
  values.flatMap((v, i) => (v == null ? [] : [{ date: addDays(start, i), value: v }]));

describe('體重趨勢', () => {
  it('同一天多筆取平均', () => {
    const m = dailyAverages([
      { date: '2026-10-01', value: 70 },
      { date: '2026-10-01', value: 71 },
    ]);
    expect(m.get('2026-10-01')).toBe(70.5);
  });
  it('7 日均只用有資料的天數，至少 4 筆', () => {
    const d = dailyAverages(series('2026-10-01', [70, null, 71, null, 72, 73, null]));
    expect(movingAverage(d, '2026-10-07')).toBeCloseTo((70 + 71 + 72 + 73) / 4, 6);
    const sparse = dailyAverages(series('2026-10-01', [70, null, null, null, 72, 73, null]));
    expect(movingAverage(sparse, '2026-10-07')).toBeNull();
  });
  it('14 天、每天 +0.05 kg → 週增重率約 0.5%', () => {
    const values = Array.from({ length: 14 }, (_, i) => 70 + i * 0.05);
    const d = dailyAverages(series('2026-10-01', values));
    const rate = weeklyRatePct(d, '2026-10-14');
    const now = values.slice(7).reduce((a, b) => a + b) / 7;
    const prev = values.slice(0, 7).reduce((a, b) => a + b) / 7;
    expect(rate).toBeCloseTo(((now - prev) / prev) * 100, 6);
    expect(rate!).toBeGreaterThan(0.49);
    expect(rate!).toBeLessThan(0.51);
  });
  it('前一週資料不足 → null', () => {
    const d = dailyAverages(series('2026-10-08', [70, 70, 70, 70, 70, 70, 70]));
    expect(weeklyRatePct(d, '2026-10-14')).toBeNull();
  });
  it('趨勢序列含缺漏日', () => {
    const d = dailyAverages(series('2026-10-01', [70, null, 71]));
    const t = trendSeries(d, '2026-10-01', '2026-10-03');
    expect(t.map((p) => p.value)).toEqual([70, null, 71]);
  });
});

describe('FFMI', () => {
  it('80 kg、15%、180 cm', () => {
    const r = ffmi(80, 15, 180)!;
    expect(r.lbmKg).toBeCloseTo(68, 6);
    expect(r.ffmi).toBeCloseTo(68 / 3.24, 6);
    expect(r.normalized).toBeCloseTo(68 / 3.24, 6);
  });
  it('身高校正', () => {
    const r = ffmi(70, 15, 170)!;
    expect(r.normalized - r.ffmi).toBeCloseTo(6.1 * 0.1, 6);
  });
  it('無效輸入', () => {
    expect(ffmi(70, 120, 170)).toBeNull();
  });
});

describe('連續紀錄天數', () => {
  it('今天還沒記錄不算中斷', () => {
    const days = new Set(['2026-10-21', '2026-10-22', '2026-10-23']);
    expect(streak(days, '2026-10-24')).toBe(3);
    days.add('2026-10-24');
    expect(streak(days, '2026-10-24')).toBe(4);
  });
  it('昨天沒記錄 → 0', () => {
    expect(streak(new Set(['2026-10-20']), '2026-10-24')).toBe(0);
  });
});
