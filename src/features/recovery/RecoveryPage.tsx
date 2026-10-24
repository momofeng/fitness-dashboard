// 恢復頁：今天的狀態、減量建議、近 14 天睡眠與精力。

import { useState } from 'react';
import { SORE_AREA_LABEL, type SoreArea } from '../../content/types';
import { addDays, rangeKeys, shortDateLabel, weekdayLabel } from '../../core/dates';
import { fmt } from '../../core/units';
import { useActiveProgram } from '../../db/repo/programs';
import { useDailyLogsRange } from '../../db/repo/recovery';
import { useSettings } from '../../db/repo/settings';
import type { DailyLog } from '../../db/schemas';
import { PageHeader, Section } from '../../ui/Layout';
import { useToday } from '../shared/useToday';
import { AdviceCard, DeloadBanner, ENERGY_LABEL, RecoveryEntry } from './RecoveryParts';
import { useRecoveryAdvice } from './useRecoveryAdvice';

const DAYS = 14;
const SLEEP_MAX = 10;

export default function RecoveryPage() {
  const settings = useSettings();
  const today = useToday(settings?.dayCutoffHour);
  const program = useActiveProgram();
  const state = useRecoveryAdvice(settings, program, today);
  const from = addDays(today, -(DAYS - 1));
  const logs = useDailyLogsRange(from, today);
  if (!settings) return null;
  const byDate = new Map((logs ?? []).map((l) => [l.date, l]));
  const s = state?.summary;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <PageHeader title="恢復" back="/more" sub="睡眠、精力、痠痛與減量建議" />
      <DeloadBanner settings={settings} today={today} />
      {state && !state.deloadActive && <AdviceCard advice={state.advice} today={today} showOk />}

      <Section title={`今天（${shortDateLabel(today)}）`}>
        <div className="card p-4">
          <RecoveryEntry date={today} />
        </div>
      </Section>

      <Section title="近 7 天">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="平均睡眠" value={s?.sleepAvg != null ? `${fmt(s.sleepAvg, 1)} 時` : '–'} sub={s ? `${s.sleepDays} 天有記錄` : ''} />
          <Stat label="平均精力" value={s?.energyAvg != null ? `${fmt(s.energyAvg, 1)}／5` : '–'} sub={s ? `${s.energyDays} 天有記錄` : ''} />
          <Stat label="最常痠" value={s?.sore[0] ? SORE_AREA_LABEL[s.sore[0].area as SoreArea] : '–'} sub={s?.sore[0] ? `${s.sore[0].days} 天` : ''} />
        </div>
      </Section>

      <Section title={`近 ${DAYS} 天睡眠`}>
        <div className="card p-4">
          <SleepChart days={rangeKeys(from, today)} byDate={byDate} lowSleepH={settings.recovery.lowSleepH} />
        </div>
      </Section>

      <Section title="明細">
        <div className="card divide-y divide-seam overflow-hidden">
          {rangeKeys(from, today)
            .reverse()
            .filter((d) => byDate.has(d))
            .map((d) => {
              const l = byDate.get(d)!;
              return (
                <div key={d} className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm">
                  <span className="num w-24 shrink-0 text-chalk-3">{shortDateLabel(d)}</span>
                  <span className="num w-14 shrink-0">{l.sleepHours != null ? `${fmt(l.sleepHours, 2)} 時` : '–'}</span>
                  <span className="w-16 shrink-0">{l.energy != null ? `精力 ${l.energy}` : '–'}</span>
                  <span className="min-w-0 flex-1 truncate text-chalk-3">{(l.soreness ?? []).map((a) => SORE_AREA_LABEL[a]).join('、')}</span>
                </div>
              );
            })}
          {rangeKeys(from, today).every((d) => !byDate.has(d)) && <p className="p-4 text-sm text-chalk-3">還沒有紀錄。每天花 5 秒記錄睡眠與精力，減量建議會更準。</p>}
        </div>
      </Section>
      <p className="px-1 text-cap text-chalk-4">減量建議依「設定 → 恢復」的門檻判斷（目前：睡眠低於 {settings.recovery.lowSleepH} 小時、精力 {settings.recovery.lowEnergy} 以下）。不是醫療建議，身體不適請就醫。</p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card flex min-w-0 flex-col gap-0.5 p-3">
      <p className="label truncate">{label}</p>
      <p className="num truncate text-h4 font-semibold">{value}</p>
      <p className="truncate text-cap text-chalk-4">{sub}</p>
    </div>
  );
}

/** 單一數列的長條圖：每天一根，含門檻虛線；點一根看當天數字 */
function SleepChart({ days, byDate, lowSleepH }: { days: string[]; byDate: Map<string, DailyLog>; lowSleepH: number }) {
  const [sel, setSel] = useState<string | null>(null);
  const h = 120;
  const y = (v: number) => (Math.min(v, SLEEP_MAX) / SLEEP_MAX) * h;
  const selLog = sel ? byDate.get(sel) : undefined;
  return (
    <figure className="flex flex-col gap-2">
      <div className="relative" style={{ height: h }}>
        <div className="absolute inset-x-0 border-t border-dashed border-chalk-4" style={{ bottom: y(lowSleepH) }} aria-hidden="true" />
        <span className="num absolute right-0 bg-iron px-1 text-cap text-chalk-3" style={{ bottom: y(lowSleepH) + 2 }} aria-hidden="true">
          {fmt(lowSleepH, 1)} 時
        </span>
        <div className="absolute inset-0 grid items-end gap-[2px]" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((d) => {
            const v = byDate.get(d)?.sleepHours;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setSel(sel === d ? null : d)}
                aria-label={`${shortDateLabel(d)} 睡眠 ${v != null ? `${fmt(v, 2)} 小時` : '未記錄'}`}
                title={v != null ? `${shortDateLabel(d)}：${fmt(v, 2)} 小時` : `${shortDateLabel(d)}：未記錄`}
                className="flex h-full items-end justify-center"
              >
                {v != null ? (
                  <span className={`block w-full rounded-t-[4px] ${sel === d ? 'bg-chalk' : 'bg-chalk-3'}`} style={{ height: Math.max(2, y(v)) }} />
                ) : (
                  <span className="block h-[2px] w-full bg-iron-3" />
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid gap-[2px] text-center text-cap text-chalk-4" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }} aria-hidden="true">
        {days.map((d, i) => (
          <span key={d} className="truncate">
            {i % 2 === days.length % 2 ? weekdayLabel(d).slice(1) : ''}
          </span>
        ))}
      </div>
      <figcaption className="num min-h-5 text-sm text-chalk-3">
        {sel
          ? `${shortDateLabel(sel)}：睡眠 ${selLog?.sleepHours != null ? `${fmt(selLog.sleepHours, 2)} 小時` : '未記錄'}${selLog?.energy != null ? `，精力 ${selLog.energy}（${ENERGY_LABEL[selLog.energy]}）` : ''}`
          : '點長條看當天數字；虛線是睡眠不足的門檻。'}
      </figcaption>
    </figure>
  );
}
