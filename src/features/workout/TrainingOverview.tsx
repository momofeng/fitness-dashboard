import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { addDays } from '../../core/dates';
import { needsReview, observationText } from '../../core/training/logging';
import { db } from '../../db/db';
import { Section } from '../../ui/Layout';
export function TrainingOverview({ today }: { today: string }) {
  const data = useLiveQuery(async () => {
    const since = addDays(today, -27);
    const workouts = (await db.workouts.where('date').between(since, today, true, true).toArray()).filter((w) => w.status === 'done');
    const ids = new Set(workouts.map((w) => w.id));
    const sets = (await db.sets.where('date').between(since, today, true, true).toArray()).filter((s) => ids.has(s.workoutId) && s.kind === 'working');
    const cardio = await db.cardio.where('date').between(since, today, true, true).toArray();
    return { workouts, sets, minutes: cardio.reduce((n, c) => n + c.minutes, 0), review: sets.filter(needsReview).sort((a, b) => b.completedAt - a.completedAt) };
  }, [today]);
  if (!data) return null;
  return <Section title="近四週追蹤"><div className="card flex flex-col gap-4 p-4">
    <div className="grid grid-cols-2 gap-4">{[['訓練次數', data.workouts.length + ' 次'], ['正式組', data.sets.length + ' 組'], ['有氧', data.minutes + ' 分鐘'], ['需注意紀錄', data.review.length + ' 組']].map(([label, value]) => <div key={label}><p className="label">{label}</p><p className="num text-h3 font-semibold">{value}</p></div>)}</div>
    {data.review.slice(0, 4).map((s) => { const w = data.workouts.find((v) => v.id === s.workoutId); const p = w?.plan.find((v) => v.id === s.planItemId || (!s.planItemId && v.exerciseId === s.exerciseId)); return <Link className="min-h-11 rounded-md bg-warn-soft p-3 text-sm text-warn" key={s.id} to={'/train/history/' + s.workoutId}>{s.date} · {p?.nameSnapshot ?? w?.dayName}：{observationText(s)}</Link>; })}
    <p className="text-sm text-chalk-3">需注意組數只計已註記的姿勢、協助或不適；未註記不代表姿勢良好。</p>
  </div></Section>;
}
