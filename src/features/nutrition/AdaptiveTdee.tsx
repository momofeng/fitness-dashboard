// 自適應 TDEE 卡片：顯示資料夠不夠、估計值與建議；只有使用者按「套用」才會改目標。

import { useLiveQuery } from 'dexie-react-hooks';
import { adaptiveTdee, ADAPTIVE, type AdaptiveResult } from '../../core/adaptiveTdee';
import { dailyAverages } from '../../core/body';
import { addDays, shortDateLabel, toDateKey } from '../../core/dates';
import type { MacroTargets } from '../../core/nutrition';
import { fmt } from '../../core/units';
import { db } from '../../db/db';
import { updateSettings } from '../../db/repo/settings';
import type { Settings } from '../../db/schemas';
import { Button } from '../../ui/Button';
import { Meter } from '../../ui/Layout';
import { toast } from '../../ui/toast';

export async function loadAdaptive(settings: Settings, targets: MacroTargets, today: string): Promise<AdaptiveResult> {
  const from = addDays(today, -ADAPTIVE.windowDays);
  const [logs, daily, body] = await Promise.all([
    db.foodLogs.where('date').between(from, today, true, true).toArray(),
    db.dailyLogs.where('date').between(from, today, true, true).toArray(),
    db.bodyMetrics.where('date').between(from, today, true, true).toArray(),
  ]);
  const byDay = new Map<string, { kcal: number; entries: number }>();
  for (const l of logs) {
    const d = byDay.get(l.date) ?? { kcal: 0, entries: 0 };
    d.kcal += l.kcal;
    d.entries += 1;
    byDay.set(l.date, d);
  }
  const complete = new Map(daily.map((d) => [d.date, d.intakeComplete]));
  const days = new Set([...byDay.keys(), ...complete.keys()]);
  return adaptiveTdee({
    today,
    intake: [...days].map((date) => ({ date, kcal: byDay.get(date)?.kcal ?? 0, entries: byDay.get(date)?.entries ?? 0, complete: complete.get(date) })),
    weights: dailyAverages(body.filter((b) => b.weightKg != null).map((b) => ({ date: b.date, value: b.weightKg! }))),
    targetKcal: targets.kcal,
    currentTdee: targets.tdee,
    lastAppliedDate: settings.nutrition.tdeeAppliedAt ? toDateKey(settings.nutrition.tdeeAppliedAt, settings.dayCutoffHour) : null,
  });
}

export function AdaptiveTdeeCard({ settings, targets, today }: { settings: Settings; targets: MacroTargets; today: string }) {
  const r = useLiveQuery(() => loadAdaptive(settings, targets, today), [settings.updatedAt, targets.kcal, targets.tdee, today]);
  if (!r) return null;
  const applied = targets.tdeeSource === 'adaptive';
  const apply = async (v: number) => {
    await updateSettings({ nutrition: { tdeeOverride: v, tdeeAppliedAt: Date.now() } });
    toast(`已套用：每日消耗改為 ${fmt(v, 0)} kcal`);
  };
  return (
    <section className="card flex flex-col gap-3 p-4" aria-label="自適應 TDEE">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-semibold">自適應 TDEE（每日消耗）</p>
        <p className="num text-sm text-chalk-3">
          目前用 {applied ? '自適應' : '公式'} {fmt(targets.tdee, 0)} kcal
        </p>
      </div>
      {r.status === 'insufficient' ? (
        <>
          <p className="text-sm text-chalk-2">
            用你實際吃的與體重變化反推每日消耗，比公式準。需要過去 {ADAPTIVE.windowDays} 天內至少 {ADAPTIVE.minIntakeDays} 天完整的飲食紀錄，以及 {ADAPTIVE.minWeighDays} 天體重（跨 {ADAPTIVE.minWeighSpanDays} 天以上）。
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col gap-1">
              <span className="num text-chalk-3">
                完整飲食 {r.effectiveDays}/{ADAPTIVE.minIntakeDays} 天
              </span>
              <Meter value={r.effectiveDays} max={ADAPTIVE.minIntakeDays} label="完整飲食天數" height={4} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="num text-chalk-3">
                體重 {r.weighDays}/{ADAPTIVE.minWeighDays} 天
              </span>
              <Meter value={r.weighDays} max={ADAPTIVE.minWeighDays} label="體重天數" height={4} />
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="num text-sm text-chalk-2">
            {shortDateLabel(r.from)}–{shortDateLabel(r.to)}：{r.effectiveDays} 天平均吃 {fmt(r.meanIntake, 0)} kcal，體重每週 {r.slopeKgPerWeek >= 0 ? '+' : ''}
            {fmt(r.slopeKgPerWeek, 2)} kg → 估計每日消耗約 <span className="font-semibold text-chalk">{fmt(r.estimate, 0)} kcal</span>
          </p>
          {r.reason === 'apply' && r.suggestion != null && (
            <div className="flex flex-col gap-2 rounded-md bg-well p-3">
              <p className="text-sm">
                建議把每日消耗從 {fmt(targets.tdee, 0)} 調整為 <span className="num font-semibold">{fmt(r.suggestion, 0)} kcal</span>
                （{r.suggestion > targets.tdee ? '+' : ''}
                {fmt(r.suggestion - targets.tdee, 0)}）。每次最多調 {ADAPTIVE.maxWeeklyChange} kcal，一週後再看。
              </p>
              <Button variant="primary" block onClick={() => void apply(r.suggestion!)}>
                套用 {fmt(r.suggestion, 0)} kcal
              </Button>
            </div>
          )}
          {r.reason === 'small' && <p className="text-sm text-go">和目前設定差不到 {ADAPTIVE.minDelta} kcal，維持即可。</p>}
          {r.reason === 'cooldown' && r.nextApplyDate && <p className="text-sm text-chalk-3">上次調整不到一週，{shortDateLabel(r.nextApplyDate)} 之後再看新的建議。</p>}
        </>
      )}
      {applied && (
        <div className="flex items-center justify-between gap-2 border-t border-seam pt-3">
          <p className="num min-w-0 text-sm text-chalk-3">公式估算：{fmt(targets.formulaTdee, 0)} kcal</p>
          <Button size="sm" variant="ghost" onClick={() => void updateSettings({ nutrition: { tdeeOverride: null, tdeeAppliedAt: null } }).then(() => toast('已改回公式估算'))}>
            回到公式估算
          </Button>
        </div>
      )}
      <p className="text-cap text-chalk-3">只是建議，不會自動改你的目標。記錄不完整的日子請在飲食頁標「不完整」，避免低估。</p>
    </section>
  );
}
