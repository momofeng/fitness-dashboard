// 減量建議需要的資料：課表主項停滯、近 7 天恢復紀錄、體重趨勢。

import { useLiveQuery } from 'dexie-react-hooks';
import { dailyAverages, rateVerdict, weeklyRatePct } from '../../core/body';
import { addDays } from '../../core/dates';
import { deloadAdvice, recoverySummary, type DeloadAdvice, type RecoverySummary } from '../../core/recovery';
import { db } from '../../db/db';
import { loadExerciseLookup } from '../../db/repo/exercises';
import { isDeloadActive, recentlyDeloaded } from '../../db/repo/recovery';
import type { Program, Settings } from '../../db/schemas';
import { stalledExercises } from '../workout/trainingStats';

export interface RecoveryState {
  stalls: Array<{ exerciseId: string; daysSincePr: number }>;
  summary: RecoverySummary;
  advice: DeloadAdvice;
  deloadActive: boolean;
}

export function useRecoveryAdvice(settings: Settings | undefined, program: Program | null | undefined, today: string): RecoveryState | undefined {
  return useLiveQuery(async () => {
    if (!settings) return undefined;
    const ids = program ? program.days.flatMap((d) => d.slots.map((s) => s.exerciseId)) : [];
    const [stalls, logs, metrics, get] = await Promise.all([
      ids.length ? stalledExercises(ids, settings, today) : Promise.resolve([]),
      db.dailyLogs.where('date').between(addDays(today, -6), today, true, true).toArray(),
      db.bodyMetrics.where('date').between(addDays(today, -21), today, true, true).toArray(),
      loadExerciseLookup(),
    ]);
    const summary = recoverySummary(logs, today);
    const daily = dailyAverages(metrics.filter((m) => m.weightKg != null).map((m) => ({ date: m.date, value: m.weightKg! })));
    const rate = weeklyRatePct(daily, today);
    const advice = deloadAdvice(
      {
        stalled: stalls.map((s) => get(s.exerciseId)?.nameZh ?? s.exerciseId),
        summary,
        weightTrend: rate == null ? null : rateVerdict(rate, settings.nutrition.weeklyGainPct).verdict,
      },
      { lowSleepH: settings.recovery.lowSleepH, lowEnergy: settings.recovery.lowEnergy },
    );
    let final = advice;
    if (advice.level === 'deload' && recentlyDeloaded(settings.recovery.deloadUntil, today)) {
      final = {
        level: 'watch',
        title: '剛做過減量週',
        reasons: advice.reasons,
        actions: ['先照原本的重量練 2 週，看看能不能突破', '持續把睡眠補足', '仍然停滯再考慮換次數範圍或動作變式'],
        offerDeload: false,
      };
    }
    return { stalls, summary, advice: final, deloadActive: isDeloadActive(settings.recovery.deloadUntil, today) };
  }, [
    settings?.updatedAt,
    program?.id,
    program?.updatedAt,
    today,
  ]);
}
