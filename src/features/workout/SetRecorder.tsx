import { useEffect, useRef, useState } from 'react';
import { FLAG_LABEL, SET_FLAGS, observationText, type SetFlag } from '../../core/training/logging';
import { fromDisplayWeight, toDisplayWeight, fmt } from '../../core/units';
import { newId } from '../../db/db';
import { LIMITS } from '../../db/limits';
import { deleteSet, restoreSet, saveSetDraft, updateSet, type SetInput } from '../../db/repo/workouts';
import type { PlanItem, SetDraft, Workout, WorkoutSet } from '../../db/schemas';
import { NumberInput, Field } from '../../ui/Fields';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { toast, toastUndo } from '../../ui/toast';

type Observation = { flags?: SetFlag[]; note?: string; discomfortArea?: string };
export function ObservationEditor({ value, onChange }: { value: Observation; onChange: (p: Observation) => void }) {
  return <div className="flex flex-col gap-3">
    <div className="flex flex-wrap gap-2">
      {SET_FLAGS.map((f) => <button key={f} type="button" aria-pressed={value.flags?.includes(f) ?? false}
        className={'press min-h-11 rounded-md border px-3 text-sm ' + (value.flags?.includes(f) ? 'border-warn bg-warn-soft text-warn' : 'border-seam text-chalk-2')}
        onClick={() => { const flags = value.flags?.includes(f) ? value.flags.filter((v) => v !== f) : [...(value.flags ?? []), f]; onChange({ ...value, flags, discomfortArea: flags.includes('discomfort') ? value.discomfortArea : undefined }); }}>{FLAG_LABEL[f]}</button>)}
    </div>
    {value.flags?.includes('discomfort') && <Field label="不適部位（選填）">
      <div className="flex flex-wrap gap-1">
        {['肩', '肘', '腕', '腰背', '髖', '膝', '踝'].map((v) => <button type="button" key={v} aria-pressed={value.discomfortArea === v} className={'press min-h-11 rounded-md px-3 text-sm ' + (value.discomfortArea === v ? 'bg-warn-soft text-warn' : 'bg-well text-chalk-2')} onClick={() => onChange({ ...value, discomfortArea: value.discomfortArea === v ? undefined : v })}>{v}</button>)}
      </div>
      <input className="field" aria-label="其他不適部位" maxLength={60} placeholder="可略過或自填部位" value={value.discomfortArea ?? ''} onChange={(e) => onChange({ ...value, discomfortArea: e.target.value })} />
    </Field>}
    <Field label="這組備註（選填）"><textarea className="field min-h-16 py-2" aria-label="這組備註" maxLength={500} value={value.note ?? ''} onChange={(e) => onChange({ ...value, note: e.target.value })} /></Field>
    <p className="text-sm text-chalk-3">沒填就是未註記，不代表姿勢良好。</p>
  </div>;
}

export type RecorderValues = Omit<SetInput, 'exerciseId' | 'kind'>;
export function SetRecorder({ workout, item, position, kind = 'working', n, name = '第 ' + n + ' 組', label, logged, defaults, unit, useRir, isNext, step = 2.5, onLog }:
  { workout: Workout; item: PlanItem; position: number; kind?: WorkoutSet['kind']; n: number; name?: string; label?: string; logged?: WorkoutSet; defaults: { weightKg: number | null; reps: number | null }; unit: 'kg' | 'lb'; useRir: boolean; isNext: boolean; step?: number; onLog: (v: RecorderValues) => Promise<void> }) {
  const draft = workout.drafts?.find((d) => d.planItemId === item.id && d.position === position && d.kind === kind);
  const id = useRef(logged?.id ?? draft?.id ?? newId()).current;
  const [values, setValues] = useState({ weightKg: logged?.weightKg ?? draft?.weightKg ?? defaults.weightKg, reps: logged?.reps ?? draft?.reps ?? defaults.reps,
    rir: logged?.rir ?? draft?.rir ?? null, flags: logged?.flags ?? draft?.flags, note: logged?.note ?? draft?.note, discomfortArea: logged?.discomfortArea ?? draft?.discomfortArea });
  const touched = useRef(!!draft);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const [expandedDraft, setExpandedDraft] = useState(kind === 'drop' && !logged);
  const [statusOpen, setStatusOpen] = useState(false);
  useEffect(() => {
    if (!isNext || logged || workout.restStartedAt == null) return;
    const frame = requestAnimationFrame(() => rowRef.current?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));
    return () => cancelAnimationFrame(frame);
  }, [isNext, workout.id, !!logged]);
  const latest = useRef(values);
  latest.current = values;
  useEffect(() => {
    if (logged || touched.current) return;
    setValues((v) => ({ ...v, ...defaults }));
  }, [defaults.weightKg, defaults.reps, logged]);
  useEffect(() => { if (logged) setValues({ weightKg: logged.weightKg, reps: logged.reps, rir: logged.rir, flags: logged.flags, note: logged.note, discomfortArea: logged.discomfortArea }); }, [logged?.updatedAt]);
  const valid = values.weightKg != null && Number.isFinite(values.weightKg) && values.weightKg >= 0 && values.weightKg <= LIMITS.setWeightKg[1] && values.reps != null && Number.isInteger(values.reps) && values.reps >= 1 && values.reps <= LIMITS.setReps[1] && (values.rir == null || Number.isFinite(values.rir) && values.rir >= 0 && values.rir <= 10);
  async function persist(next = latest.current) {
    if (!item.id && !logged) return false;
    if (next.weightKg != null && (!Number.isFinite(next.weightKg) || next.weightKg < 0 || next.weightKg > LIMITS.setWeightKg[1])) return false;
    if (next.reps != null && (!Number.isInteger(next.reps) || next.reps < 0 || next.reps > LIMITS.setReps[1])) return false;
    if (next.rir != null && (!Number.isFinite(next.rir) || next.rir < 0 || next.rir > 10)) return false;
    try {
      if (logged) {
        if (next.weightKg == null || next.reps == null || next.reps < 1) return false;
        await updateSet(logged.id, { ...next, weightKg: next.weightKg, reps: next.reps });
      } else {
        const row: SetDraft = { ...next, id, planItemId: item.id!, kind, position };
        await saveSetDraft(workout.id, row);
      }
      return true;
    } catch { toast('儲存失敗，輸入仍保留在畫面，請重試', { tone: 'error' }); return false; }
  }
  function change(patch: Partial<typeof values>, commit = false) {
    touched.current = true;
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setValues(next);
    if (commit) void persist(next);
  }
  async function complete() {
    if (!valid || busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      const v = latest.current;
      await onLog({ ...v, weightKg: v.weightKg!, reps: v.reps!, setId: id, planItemId: item.id, position });
    } catch (e) { toast('記錄失敗，請重試：' + (e instanceof Error ? e.message : String(e)), { tone: 'error' }); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const fields = <div className="flex flex-col gap-3">
    <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2">
      <Field label={'重量（' + unit + '）'}><NumberInput ariaLabel={name + '重量'} value={values.weightKg == null ? null : Number(toDisplayWeight(values.weightKg, unit).toFixed(2))}
        step={step} stepper={isNext || editOpen || expandedDraft} clamp={false} min={0} max={toDisplayWeight(LIMITS.setWeightKg[1], unit)} decimals={2} placeholder="填重量"
        onChange={(v) => change({ weightKg: v == null ? null : fromDisplayWeight(v, unit) })}
        onCommit={(v) => change({ weightKg: v == null ? null : fromDisplayWeight(v, unit) }, true)} /></Field>
      <Field label="次數" error={values.reps != null && !Number.isInteger(values.reps) ? '次數請填整數' : null}><NumberInput ariaLabel={name + '次數'} value={values.reps} decimals={0} stepper={isNext || editOpen || expandedDraft} clamp={false} min={1} max={LIMITS.setReps[1]}
        onChange={(v) => change({ reps: v })} onCommit={(v) => change({ reps: v }, true)} /></Field>
    </div>
    {useRir && <Field label="RIR（選填）"><NumberInput ariaLabel={name + ' RIR'} value={values.rir} min={0} max={10} clamp={false} decimals={0}
      onChange={(v) => change({ rir: v })} onCommit={(v) => change({ rir: v }, true)} /></Field>}
    {(!logged || editOpen) && <button type="button" className="press min-h-11 text-left text-sm text-chalk-2" aria-expanded={statusOpen} onClick={() => setStatusOpen(!statusOpen)}>狀態與備註 · {observationText(values)} {statusOpen ? '收合' : '＋'}</button>}
    {statusOpen && <ObservationEditor value={values} onChange={(p) => change(p, true)} />}
  </div>;
  return <div ref={rowRef} className={'rounded-md p-3 ' + (logged ? 'bg-go-soft/40' : isNext ? 'border border-seam-strong bg-iron-2' : 'bg-well')}>
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className={'font-semibold ' + (logged ? 'text-go' : 'text-chalk-2')}>{label ?? name}{logged && ' · 已完成'}</span>
      {logged && <button type="button" aria-label={'編輯' + name} className="press min-h-11 px-2 text-sm text-chalk-2" onClick={() => { setEditOpen(true); setStatusOpen(true); }}>編輯／補記</button>}
    </div>
    {logged ? <><p className="num text-h4 font-semibold">{fmt(toDisplayWeight(logged.weightKg, unit), 2)} {unit} × {logged.reps}{logged.rir != null && ' · RIR ' + logged.rir}</p><p className="mt-1 break-words text-sm text-chalk-3">{observationText(logged)}</p></> :
      <>{(isNext || expandedDraft) ? <>{fields}<Button variant={isNext ? 'primary' : 'secondary'} size="lg" block className="mt-3" disabled={!valid || busy} onClick={() => void complete()} aria-label={'完成' + name}>{busy ? '儲存中…' : '完成這組'}</Button></> : <button type="button" className="press flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm text-chalk-3" onClick={() => setExpandedDraft(true)}>
        <span className="num">待做 · {values.weightKg == null ? '重量待填' : fmt(toDisplayWeight(values.weightKg, unit), 2) + ' ' + unit} × {values.reps ?? '–'}</span><span>調整這組</span></button>}</>}
    <Sheet open={editOpen} title={name + '紀錄'} onClose={() => setEditOpen(false)}
      footer={<div className="flex gap-2"><Button variant="danger" onClick={async () => { if (!logged) return; const removed = await deleteSet(logged.id); setEditOpen(false); if (removed) toastUndo('已撤銷' + name, () => restoreSet(removed)); }}>撤銷這組</Button><Button variant="primary" block disabled={!valid} onClick={async () => { if (await persist()) setEditOpen(false); }}>完成編輯</Button></div>}>
      {fields}
    </Sheet>
  </div>;
}
