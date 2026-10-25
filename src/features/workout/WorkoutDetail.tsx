import { Link, useNavigate, useParams } from 'react-router';
import { shortDateLabel } from '../../core/dates';
import { tonnage } from '../../core/training/volume';
import { fmt, toDisplayWeight } from '../../core/units';
import { useExerciseLookup } from '../../db/repo/exercises';
import { useSettings } from '../../db/repo/settings';
import { deleteWorkout, restoreWorkout, useWorkout, useWorkoutSets } from '../../db/repo/workouts';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { EmptyState, goBackOr, PageHeader, Section } from '../../ui/Layout';
import { toastUndo } from '../../ui/toast';

export default function WorkoutDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const workout = useWorkout(id);
  const sets = useWorkoutSets(id);
  const settings = useSettings();
  const { get } = useExerciseLookup();

  if (workout === undefined || sets === undefined || !settings) return null;
  if (workout === null) return <EmptyState icon="history" title="找不到這場訓練" />;
  const unit = settings.units.weight;
  const exerciseIds = [...new Set([...sets].sort((a, b) => a.completedAt - b.completedAt).map((s) => s.exerciseId))];
  const minutes = workout.endedAt ? Math.round((workout.endedAt - workout.startedAt) / 60000) : null;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <PageHeader title={workout.dayName} back="/train/history" sub={shortDateLabel(workout.date)} />

      <div className="grid grid-cols-3 gap-2">
        <div className="card flex flex-col p-3">
          <span className="label">時間</span>
          <span className="num text-h3 font-semibold">{minutes ?? '–'}<span className="ml-0.5 text-sm font-normal text-chalk-3">分</span></span>
        </div>
        <div className="card flex flex-col p-3">
          <span className="label">正式組</span>
          <span className="num text-h3 font-semibold">{sets.filter((s) => s.kind === 'working').length}</span>
        </div>
        <div className="card flex flex-col p-3">
          <span className="label">訓練量</span>
          <span className="num text-h3 font-semibold">
            {fmt(toDisplayWeight(tonnage(sets), unit), 0)}
            <span className="ml-0.5 text-sm font-normal text-chalk-3">{unit}</span>
          </span>
        </div>
      </div>

      {workout.summary && workout.summary.prs.length > 0 && (
        <Section title="新紀錄">
          <div className="flex flex-col gap-2">
            {workout.summary.prs.map((p) => (
              <p key={p} className="flex items-center gap-2 rounded-md bg-go-soft px-3 py-2 font-medium text-go">
                <Icon name="star" size={18} />
                {p}
              </p>
            ))}
          </div>
        </Section>
      )}

      <Section title="動作">
        <div className="flex flex-col gap-3">
          {exerciseIds.map((exId) => {
            const list = sets.filter((s) => s.exerciseId === exId);
            const msg = workout.summary?.messages.find((m) => m.exerciseId === exId)?.text;
            return (
              <div key={exId} className="card p-4">
                <Link to={`/train/exercise/${exId}`} className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-h4 font-semibold">{get(exId)?.nameZh ?? exId}</h3>
                  <Icon name="chevronRight" size={18} className="shrink-0 text-chalk-3" />
                </Link>
                <ol className="mt-2 flex flex-col gap-1">
                  {list.map((s, i) => (
                    <li key={s.id} className="num flex items-center gap-3 text-base">
                      <span className={`w-8 text-sm ${s.kind === 'working' ? 'text-chalk-2' : 'text-chalk-3'}`}>
                        {s.kind === 'warmup' ? '暖' : s.kind === 'drop' ? '遞減' : list.filter((x, j) => x.kind === 'working' && j <= i).length}
                      </span>
                      <span className={s.kind === 'working' ? '' : 'text-chalk-3'}>
                        {fmt(toDisplayWeight(s.weightKg, unit), 2)} {unit} × {s.reps}
                        {s.rir != null && <span className="ml-2 text-sm text-chalk-3">RIR {s.rir}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
                {msg && <p className="mt-2 rounded-md bg-well px-3 py-2 text-sm text-chalk-2">{msg}</p>}
              </div>
            );
          })}
          {exerciseIds.length === 0 && <p className="px-1 text-chalk-3">這場沒有記錄任何組。</p>}
        </div>
      </Section>

      <Button
        variant="danger"
        icon="trash"
        block
        onClick={async () => {
          const backup = await deleteWorkout(workout.id);
          goBackOr(navigate, '/train/history');
          if (backup) toastUndo('已刪除這場訓練', () => restoreWorkout(backup));
        }}
      >
        刪除這場訓練
      </Button>
      <p className="px-1 text-cap text-chalk-3">刪除不會改回已經計算過的下次重量。</p>
    </div>
  );
}
