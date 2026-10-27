import { WorkoutShare } from './WorkoutShare';
import { useLiveQuery } from 'dexie-react-hooks';
import { shortDateLabel } from '../../core/dates';
import { tonnage } from '../../core/training/volume';
import { fmt, toDisplayWeight } from '../../core/units';
import { db } from '../../db/db';
import { useSettings } from '../../db/repo/settings';
import { useDoneWorkouts } from '../../db/repo/workouts';
import { EmptyState, ListRow, PageHeader } from '../../ui/Layout';

export default function History() {
  const settings = useSettings();
  const workouts = useDoneWorkouts();
  const stats = useLiveQuery(async () => {
    const sets = await db.sets.toArray();
    const by = new Map<string, { sets: number; volume: number }>();
    for (const s of sets) {
      const cur = by.get(s.workoutId) ?? { sets: 0, volume: 0 };
      if (s.kind === 'working') cur.sets += 1;
      cur.volume += tonnage([s]);
      by.set(s.workoutId, cur);
    }
    return by;
  }, []);
  if (!settings || !workouts) return null;
  const unit = settings.units.weight;

  // 依月份分組
  const groups = new Map<string, typeof workouts>();
  for (const w of workouts) {
    const key = w.date.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), w]);
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      <PageHeader title="訓練紀錄" back="/train" sub={`共 ${workouts.length} 場`} />
      {workouts[0] && <WorkoutShare date={workouts[0].date} />}
      {workouts.length === 0 && <EmptyState icon="history" title="還沒有訓練紀錄" body="完成一場訓練後會出現在這裡。" />}
      {[...groups].map(([month, list]) => (
        <section key={month} className="flex flex-col gap-2">
          <h2 className="label px-1">
            {month.slice(0, 4)} 年 {Number(month.slice(5))} 月 · {list.length} 場
          </h2>
          <div className="card divide-y divide-seam overflow-hidden">
            {list.map((w) => {
              const st = stats?.get(w.id);
              return (
                <ListRow key={w.id} to={`/train/history/${w.id}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-medium">{w.dayName}</p>
                    <p className="num shrink-0 text-sm text-chalk-3">{shortDateLabel(w.date)}</p>
                  </div>
                  <p className="num text-sm text-chalk-3">
                    {st ? `${st.sets} 組 · ${fmt(toDisplayWeight(st.volume, unit), 0)} ${unit}` : ''}
                    {w.endedAt ? ` · ${Math.round((w.endedAt - w.startedAt) / 60000)} 分鐘` : ''}
                    {w.summary?.prs.length ? ` · ⭐ ${w.summary.prs.length}` : ''}
                  </p>
                </ListRow>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
