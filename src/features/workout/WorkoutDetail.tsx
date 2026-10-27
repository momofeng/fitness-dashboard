import { Link, useNavigate, useParams } from 'react-router';
import { useState } from 'react';
import { shortDateLabel } from '../../core/dates';
import { tonnage } from '../../core/training/volume';
import { belongsToItem, WEIGHT_LABEL } from '../../core/training/logging';
import { fmt, toDisplayWeight, fromDisplayWeight } from '../../core/units';
import { useExerciseLookup } from '../../db/repo/exercises';
import { useSettings } from '../../db/repo/settings';
import { confirmNextWeight, deleteWorkout, restoreWorkout, useWorkout, useWorkoutSets, updateWorkoutDetails } from '../../db/repo/workouts';
import { Button } from '../../ui/Button';
import { Field, NumberInput } from '../../ui/Fields';
import { EmptyState, goBackOr, PageHeader, Section } from '../../ui/Layout';
import { toast, toastUndo } from '../../ui/toast';
import { WorkoutShare } from './WorkoutShare';
import { SetRecorder } from './SetRecorder';
import { contextText } from './MachineEditor';

export default function WorkoutDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const workout = useWorkout(id);
  const sets = useWorkoutSets(id);
  const settings = useSettings();
  const { get } = useExerciseLookup();
  if (workout === undefined || sets === undefined || !settings) return null;
  if (workout === null) return <EmptyState icon="history" title="找不到這場訓練" />;
  const minutes = workout.endedAt ? Math.round((workout.endedAt - workout.startedAt) / 60000) : null;
  const plan = [...workout.plan];
  for (const exerciseId of new Set(sets.filter((s) => !plan.some((p, i) => belongsToItem(s, p, i, plan))).map((s) => s.exerciseId))) {
    plan.push({ exerciseId, sets: 0, repMin: 1, repMax: 100, targetWeightKg: null, targetReps: 1, restSec: 0, progression: 'none', incrementKg: 0 });
  }
  return <div className="flex flex-col gap-6 pb-6">
    <PageHeader title={workout.dayName} back="/train/history" sub={shortDateLabel(workout.date)} />
    <div className="grid grid-cols-3 gap-2">
      <div className="card p-3"><p className="label">時間</p><p className="num text-h3 font-semibold">{minutes ?? '–'} 分</p></div>
      <div className="card p-3"><p className="label">正式組</p><p className="num text-h3 font-semibold">{sets.filter((s) => s.kind === 'working').length} 組</p></div>
      <div className="card p-3"><p className="label">標示重量訓練量</p><p className="num text-h3 font-semibold">{fmt(toDisplayWeight(tonnage(sets), settings.units.weight), 0)}</p><p className="text-sm text-chalk-3">{settings.units.weight} · 次</p></div>
    </div>
    <WorkoutShare workoutId={workout.id} />
    {workout.correctedAt && <p className="rounded-md bg-warn-soft p-3 text-sm text-warn">紀錄已更正，統計與分享已更新。既有下次重量不倒推覆寫，請在下方確認。</p>}
    {!!workout.summary?.prs.length && <Section title="新紀錄">{workout.summary.prs.map((p) => <p className="rounded-md bg-go-soft p-3 text-go" key={p}>{p}</p>)}</Section>}
    <Section title="動作與逐組狀態">
      <div className="flex flex-col gap-4">{plan.map((item, index) => {
        const list = sets.filter((s) => belongsToItem(s, item, index, plan));
        const unit = item.context?.unit ?? settings.units.weight;
        return <section className="card flex flex-col gap-3 p-4" key={item.id ?? index} aria-label={item.nameSnapshot ?? get(item.exerciseId)?.nameZh}>
          <Link to={'/train/exercise/' + item.exerciseId} className="min-h-11 text-h4 font-semibold">{item.nameSnapshot ?? get(item.exerciseId)?.nameZh ?? item.exerciseId}</Link>
          <p className="text-sm text-chalk-3">{WEIGHT_LABEL[item.context?.weightMeaning ?? 'unknown']} · 正式組 {list.filter((s) => s.kind === 'working').length}／計畫 {item.sets}</p>
          {contextText(item.context) && <p className="break-words text-sm text-chalk-2">{contextText(item.context)}</p>}
          {item.skipReason && <p className="text-sm text-warn">跳過剩餘組：{item.skipReason}</p>}
          {item.replacedBy && <p className="text-sm text-warn">剩餘組改用：{plan.find((p) => p.id === item.replacedBy)?.nameSnapshot ?? '替代動作'}</p>}
          {list.map((s, n) => <SetRecorder key={s.id} workout={workout} item={item} position={s.position ?? n} kind={s.kind}
            n={list.filter((v, j) => v.kind === s.kind && j <= n).length} label={s.kind === 'working' ? undefined : s.kind === 'warmup' ? '暖身組' : '遞減組'}
            logged={s} defaults={{ weightKg: s.weightKg, reps: s.reps }} unit={unit} useRir={settings.training.useRir} isNext={false} step={item.context?.step}
            onLog={async () => undefined} />)}
          {!list.length && <p className="text-sm text-chalk-3">未記錄任何組</p>}
          {workout.summary?.messages.filter((m) => m.exerciseId === item.exerciseId).map((m) => <p className="rounded-md bg-well p-3 text-sm text-chalk-2" key={m.exerciseId}>{m.text}</p>)}
          {workout.correctedAt && <NextWeight exerciseId={item.exerciseId} unit={unit} />}
        </section>;
      })}</div>
    </Section>
    <Field label="給教練的備註"><textarea aria-label="給教練的備註" className="field min-h-20 py-2" defaultValue={workout.notes} maxLength={2000} onBlur={(e) => void updateWorkoutDetails(workout.id, { notes: e.target.value })} /></Field>
    <Button variant="danger" icon="trash" block onClick={async () => { const backup = await deleteWorkout(workout.id); goBackOr(navigate, '/train/history'); if (backup) toastUndo('已刪除這場訓練', () => restoreWorkout(backup)); }}>刪除這場訓練</Button>
    <p className="text-sm text-chalk-3">刪除不會改回已經計算過的下次重量。</p>
  </div>;
}
function NextWeight({ exerciseId, unit }: { exerciseId: string; unit: 'kg' | 'lb' }) {
  const [weight, setWeight] = useState<number | null>(null);
  return <div className="flex flex-col gap-2"><Field label="手動確認下次重量"><NumberInput ariaLabel="手動確認下次重量" value={weight} clamp={false} min={0} max={toDisplayWeight(1000, unit)} suffix={unit} onChange={setWeight} /></Field>
    <Button disabled={weight == null || weight < 0 || fromDisplayWeight(weight, unit) > 1000} onClick={async () => { try { await confirmNextWeight(exerciseId, fromDisplayWeight(weight!, unit)); toast('已確認下次重量'); } catch { toast('儲存失敗，請重試', { tone: 'error' }); } }}>確認下次重量</Button></div>;
}
