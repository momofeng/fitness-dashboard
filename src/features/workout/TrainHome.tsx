import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { relativeDayLabel } from '../../core/dates';
import { fmt, toDisplayWeight } from '../../core/units';
import { db } from '../../db/db';
import { loadExerciseLookup, useExerciseLookup } from '../../db/repo/exercises';
import { useActiveProgram } from '../../db/repo/programs';
import { useSettings } from '../../db/repo/settings';
import { planItemFor, startWorkout, useActiveWorkout, useDoneWorkouts } from '../../db/repo/workouts';
import { unlockAudio } from '../../lib/platform';
import { Button } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/Icon';
import { EmptyState, ListRow, PageHeader, Section } from '../../ui/Layout';
import { useToday } from '../shared/useToday';
import { stalledExercises, weekVolume } from './trainingStats';
import { VolumeList } from './VolumeList';

export default function TrainHome() {
  const navigate = useNavigate();
  const settings = useSettings();
  const today = useToday(settings?.dayCutoffHour);
  const program = useActiveProgram();
  const active = useActiveWorkout();
  const recent = useDoneWorkouts(3);
  const { get } = useExerciseLookup();
  const [dayOverride, setDayOverride] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  const dayIndex = program ? (dayOverride ?? program.nextDayIndex % program.days.length) : 0;
  const day = program?.days[dayIndex];

  const preview = useLiveQuery(async () => {
    if (!day) return [];
    const lookup = await loadExerciseLookup();
    return Promise.all(day.slots.map((s) => planItemFor(s, lookup)));
  }, [program?.id, program?.updatedAt, dayIndex]);

  const week = useLiveQuery(() => (settings ? weekVolume(today, settings.weekStart) : undefined), [today, settings?.weekStart]);
  const stalls = useLiveQuery(
    () => (settings && program ? stalledExercises(program.days.flatMap((d) => d.slots.map((s) => s.exerciseId)), settings, today) : []),
    [program?.id, today, settings?.training.stallSessions, settings?.training.stallMinDays],
  );

  if (!settings) return null;
  const unit = settings.units.weight;

  async function start(free = false) {
    unlockAudio();
    setStarting(true);
    try {
      const id = await startWorkout(free || !program ? {} : { program, dayIndex });
      navigate(`/train/session/${id}`);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      <PageHeader title="訓練" />

      {active ? (
        <div className="card flex flex-col gap-3 p-5">
          <p className="label">進行中</p>
          <p className="text-h2 font-semibold">{active.dayName}</p>
          <Button variant="primary" size="lg" block iconRight="chevronRight" onClick={() => navigate(`/train/session/${active.id}`)}>
            繼續訓練
          </Button>
        </div>
      ) : program && day ? (
        <div className="card flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="label">下一次 · {program.name}</p>
              <p className="text-h1 font-semibold">{day.name}</p>
            </div>
            <Link to="/train/program" className="press flex h-9 shrink-0 items-center gap-1 rounded-md px-2 text-sm text-chalk-3 hover:bg-iron-2">
              課表
              <Icon name="chevronRight" size={16} />
            </Link>
          </div>
          {program.days.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto" role="radiogroup" aria-label="選擇訓練日">
              {program.days.map((d, i) => (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={i === dayIndex}
                  onClick={() => setDayOverride(i)}
                  className={`press h-8 shrink-0 rounded-full border px-3 text-sm ${i === dayIndex ? 'border-chalk bg-chalk font-medium text-on-chalk' : 'border-seam text-chalk-3'}`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          )}
          <ol className="flex flex-col divide-y divide-seam">
            {(preview ?? []).map((p, i) => (
              <li key={`${p.exerciseId}-${i}`} className="flex items-center gap-3 py-2">
                <span className="num w-5 shrink-0 text-sm text-chalk-4">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{get(p.exerciseId)?.nameZh ?? p.exerciseId}</span>
                <span className="num shrink-0 text-sm text-chalk-2">
                  {p.sets}×{p.repMin === p.repMax ? p.repMax : `${p.repMin}–${p.repMax}`}
                  {p.targetWeightKg != null && <span className="ml-2 font-semibold text-chalk">{fmt(toDisplayWeight(p.targetWeightKg, unit), 2)} {unit}</span>}
                </span>
              </li>
            ))}
          </ol>
          {(preview ?? []).every((p) => p.targetWeightKg == null) && (
            <p className="rounded-md bg-well px-3 py-2 text-sm text-chalk-3">第一次練這份課表：先用能標準做完的重量，練完後 App 會依表現算出下次重量。</p>
          )}
          <Button variant="primary" size="lg" block icon="play" disabled={starting} onClick={() => void start()}>
            開始訓練
          </Button>
          <Button variant="ghost" block onClick={() => void start(true)}>
            不照課表，自由訓練
          </Button>
        </div>
      ) : (
        <EmptyState
          icon="note"
          title="還沒有課表"
          body="選一份範本開始，或直接自由訓練。"
          action={
            <div className="flex gap-2">
              <Link to="/train/program" className="press inline-flex h-11 items-center rounded-md bg-chalk px-4 font-semibold text-on-chalk">
                選擇課表
              </Link>
              <Button onClick={() => void start(true)}>自由訓練</Button>
            </div>
          }
        />
      )}

      {stalls && stalls.length > 0 && (
        <Section title="停滯提醒">
          <div className="card flex flex-col gap-2 p-4">
            {stalls.map((s) => (
              <Link key={s.exerciseId} to={`/train/exercise/${s.exerciseId}`} className="flex items-start gap-3 rounded-md bg-warn-soft px-3 py-2">
                <Icon name="info" size={18} className="mt-0.5 shrink-0 text-warn" />
                <span className="min-w-0 text-sm">
                  <span className="font-medium text-chalk">{get(s.exerciseId)?.nameZh}</span>
                  <span className="text-chalk-2">：{s.daysSincePr} 天沒有進步。先檢查體重有沒有在增加、睡眠是否足夠；再考慮換次數範圍，或退 10% 重新往上加。</span>
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {week && (
        <Section
          title={`本週 · 已練 ${week.sessions}${program ? ` / ${program.daysPerWeek}` : ''} 次`}
        >
          <div className="card p-4">
            <VolumeList volume={week.volume} min={settings.training.volumeMin} max={settings.training.volumeMax} />
          </div>
        </Section>
      )}

      <Section title="最近訓練" action={<Link to="/train/history" className="text-sm text-chalk-3 hover:text-chalk">全部紀錄</Link>}>
        {recent && recent.length > 0 ? (
          <div className="card divide-y divide-seam overflow-hidden">
            {recent.map((w) => (
              <ListRow key={w.id} to={`/train/history/${w.id}`}>
                <p className="font-medium">{w.dayName}</p>
                <p className="text-sm text-chalk-3">
                  {relativeDayLabel(w.date, today)}
                  {w.endedAt && ` · ${Math.round((w.endedAt - w.startedAt) / 60000)} 分鐘`}
                  {w.summary?.prs.length ? ` · ${w.summary.prs.length} 項新紀錄` : ''}
                </p>
              </ListRow>
            ))}
          </div>
        ) : (
          <p className="px-1 text-sm text-chalk-3">完成第一場訓練後會出現在這裡。</p>
        )}
      </Section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ['/train/program', 'note', '課表'],
            ['/train/exercises', 'dumbbell', '動作庫'],
            ['/train/history', 'history', '訓練紀錄'],
            ['/train/cardio', 'run', '有氧'],
          ] as Array<[string, IconName, string]>
        ).map(([to, icon, label]) => (
          <Link key={to} to={to} className="press card flex h-16 items-center gap-3 px-4 hover:bg-iron-2">
            <Icon name={icon} className="text-chalk-3" />
            <span className="font-medium">{label}</span>
          </Link>
        ))}
      </div>
      <TodayCardioHint today={today} />
    </div>
  );
}

function TodayCardioHint({ today }: { today: string }) {
  const n = useLiveQuery(() => db.cardio.where('date').equals(today).count(), [today]);
  if (!n) return null;
  return <p className="px-1 text-sm text-chalk-3">今天已記錄 {n} 筆有氧。</p>;
}
