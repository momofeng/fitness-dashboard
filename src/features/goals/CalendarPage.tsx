// 月曆熱圖：一個指標一張圖（訓練組數、蛋白質達成率、習慣完成率、睡眠），單一綠色色階，點日期看明細。

import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { heatLevel, monthGrid, type HeatMetric } from '../../core/goals';
import { parseDateKey, shortDateLabel, toDateKey } from '../../core/dates';
import { fmt } from '../../core/units';
import { useHabits } from '../../db/repo/goals';
import { db } from '../../db/db';
import { IconButton } from '../../ui/Button';
import { Segmented } from '../../ui/Fields';
import { PageHeader } from '../../ui/Layout';
import { useTargets } from '../shared/useToday';
import { habitDoneDates, loadDayFacts } from './facts';

const METRIC_LABEL: Record<HeatMetric, string> = { training: '訓練', protein: '蛋白質', habits: '習慣', sleep: '睡眠' };
const LEGEND: Record<HeatMetric, [string, string, string, string]> = {
  training: ['1–9 組', '10–15', '16–20', '21+'],
  protein: ['<50%', '50–80%', '80–90%', '≥90%'],
  habits: ['≤⅓', '≤⅔', '大部分', '全部'],
  sleep: ['<5 時', '5–6', '6–7', '≥7'],
};
const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

export default function CalendarPage() {
  const { settings, today, targets } = useTargets();
  const habits = useHabits();
  const t = parseDateKey(today);
  const [ym, setYm] = useState({ y: t.getFullYear(), m: t.getMonth() + 1 });
  const [metric, setMetric] = useState<HeatMetric>('training');
  const [sel, setSel] = useState<string | null>(null);
  const weekStart = settings?.weekStart ?? 1;
  const grid = monthGrid(ym.y, ym.m, weekStart);
  const days = grid.flat().filter((d): d is string => d != null);
  const from = days[0]!;
  const to = days.at(-1)!;
  const data = useLiveQuery(async () => {
    const [facts, logs] = await Promise.all([loadDayFacts(from, to), db.habitLogs.where('date').between(from, to, true, true).toArray()]);
    return { facts, manual: new Set(logs.map((l) => l.id)) };
  }, [from, to]);

  if (!settings || !habits) return null;
  const activeHabits = habits.filter((h) => !h.archived);
  const habitTargets = { proteinG: targets?.protein ?? null, waterMl: settings.nutrition.waterTargetMl };
  const habitDone = new Map<string, number>();
  const habitStart = new Map(activeHabits.map((h) => [h.id, toDateKey(h.createdAt, settings.dayCutoffHour)]));
  const habitsOn = (d: string) => activeHabits.filter((h) => habitStart.get(h.id)! <= d).length;
  if (data) {
    for (const h of activeHabits)
      for (const d of habitDoneDates(h, data.facts, data.manual, habitTargets)) if (habitStart.get(h.id)! <= d) habitDone.set(d, (habitDone.get(d) ?? 0) + 1);
  }

  const valueOf = (d: string): number | null => {
    const f = data?.facts.get(d);
    if (!f) return null;
    switch (metric) {
      case 'training':
        return f.workingSets || (f.workout ? 1 : 0);
      case 'protein':
        return targets?.protein ? f.proteinG / targets.protein : null;
      case 'habits':
        return habitsOn(d) ? (habitDone.get(d) ?? 0) / habitsOn(d) : null;
      case 'sleep':
        return f.sleepH;
    }
  };
  const describe = (d: string): string => {
    const f = data?.facts.get(d);
    if (!f) return '沒有資料';
    switch (metric) {
      case 'training':
        return f.workout || f.workingSets ? `${f.workingSets} 組正式組` : '沒有訓練';
      case 'protein':
        return f.foodLogged ? `蛋白質 ${fmt(f.proteinG, 0)} g${targets ? ` / ${targets.protein} g` : ''}` : '沒有飲食紀錄';
      case 'habits':
        return habitsOn(d) ? `習慣 ${habitDone.get(d) ?? 0}/${habitsOn(d)}` : '這天還沒有設定習慣';
      case 'sleep':
        return f.sleepH != null ? `睡眠 ${fmt(f.sleepH, 2)} 小時` : '沒有睡眠紀錄';
    }
  };
  const shift = (n: number) => {
    const d = new Date(ym.y, ym.m - 1 + n, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() + 1 });
    setSel(null);
  };
  const isFutureMonth = ym.y > t.getFullYear() || (ym.y === t.getFullYear() && ym.m >= t.getMonth() + 1);
  const headers = Array.from({ length: 7 }, (_, i) => WEEK_LABELS[(i + weekStart) % 7]!);
  const selFacts = sel ? data?.facts.get(sel) : undefined;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader title="月曆" back="/goals" sub="每天做到了什麼" />
      <Segmented ariaLabel="指標" value={metric} options={(Object.keys(METRIC_LABEL) as HeatMetric[]).map((k) => ({ value: k, label: METRIC_LABEL[k] }))} onChange={setMetric} />
      <div className="card flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <IconButton icon="chevronLeft" label="上個月" onClick={() => shift(-1)} />
          <h2 className="num text-h4 font-semibold">
            {ym.y} 年 {ym.m} 月
          </h2>
          <IconButton icon="chevronRight" label="下個月" disabled={isFutureMonth} onClick={() => shift(1)} />
        </div>
        <div role="grid" aria-label={`${ym.y} 年 ${ym.m} 月 ${METRIC_LABEL[metric]}`} className="flex flex-col gap-[2px]">
          <div role="row" className="grid grid-cols-7 gap-[2px]">
            {headers.map((h) => (
              <span key={h} role="columnheader" className="text-center text-cap text-chalk-3">
                {h}
              </span>
            ))}
          </div>
          {grid.map((row, i) => (
            <div key={i} role="row" className="grid grid-cols-7 gap-[2px]">
              {row.map((d, j) =>
                d ? (
                  <button
                    key={d}
                    type="button"
                    role="gridcell"
                    aria-selected={sel === d}
                    aria-label={`${shortDateLabel(d)}：${describe(d)}`}
                    disabled={d > today}
                    onClick={() => setSel(sel === d ? null : d)}
                    className={`press num flex aspect-square min-w-0 items-start justify-start rounded-[4px] p-1 text-sm font-medium disabled:opacity-30 ${sel === d ? 'ring-2 ring-chalk' : ''} ${d === today ? 'underline decoration-2 underline-offset-2' : ''}`}
                    style={{ background: `var(--heat-${d > today ? 0 : heatLevel(metric, valueOf(d))})`, color: `var(--heat-ink-${d > today ? 0 : heatLevel(metric, valueOf(d))})` }}
                  >
                    {parseDateKey(d).getDate()}
                  </button>
                ) : (
                  <span key={`x${j}`} role="gridcell" aria-hidden="true" />
                ),
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-cap text-chalk-3" aria-label="圖例">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-[3px]" style={{ background: 'var(--heat-0)' }} />無
          </span>
          {LEGEND[metric].map((l, i) => (
            <span key={l} className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-[3px]" style={{ background: `var(--heat-${i + 1})` }} />
              {l}
            </span>
          ))}
        </div>
      </div>
      <div className="card min-h-20 p-4" aria-live="polite">
        {sel ? (
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-semibold">{shortDateLabel(sel)}</p>
            <p className="text-chalk-2">{selFacts?.workout || selFacts?.workingSets ? `訓練 ${selFacts.workingSets} 組` : '沒有訓練'}</p>
            <p className="text-chalk-2">{selFacts?.foodLogged ? `蛋白質 ${fmt(selFacts.proteinG, 0)} g` : '沒有飲食紀錄'}</p>
            <p className="text-chalk-2">{selFacts?.sleepH != null ? `睡眠 ${fmt(selFacts.sleepH, 2)} 小時` : '沒有睡眠紀錄'}</p>
            {habitsOn(sel) > 0 && (
              <p className="text-chalk-2">
                習慣 {habitDone.get(sel) ?? 0}/{habitsOn(sel)}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-chalk-3">點日期看當天的訓練、蛋白質、睡眠與習慣。蛋白質達成率用目前的目標計算。</p>
        )}
      </div>
    </div>
  );
}
