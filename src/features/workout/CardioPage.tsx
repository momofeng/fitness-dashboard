import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { CARDIO_TYPES } from '../../content';
import { addDays, shortDateLabel } from '../../core/dates';
import { fmt } from '../../core/units';
import { db } from '../../db/db';
import { LIMITS, isValidDay } from '../../db/limits';
import { useSettings } from '../../db/repo/settings';
import { saveCardio } from '../../db/repo/cardio';
import type { Cardio } from '../../db/schemas';
import { Button, IconButton } from '../../ui/Button';
import { Field, NumberInput, TextField } from '../../ui/Fields';
import { EmptyState, PageHeader, Section } from '../../ui/Layout';
import { toast, toastUndo } from '../../ui/toast';
import { useToday } from '../shared/useToday';
import { WorkoutShare } from './WorkoutShare';

export default function CardioPage() {
  const settings = useSettings();
  const today = useToday(settings?.dayCutoffHour);
  const rows = useLiveQuery(async () => (await db.cardio.toArray()).sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt), []);
  const initialized = useRef(false);
  const [ready, setReady] = useState(false);
  const [type, setType] = useState<string>('快走');
  const [minutes, setMinutes] = useState<number | null>(30);
  const [km, setKm] = useState<number | null>(null);
  const [kcal, setKcal] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [incline, setIncline] = useState<number | null>(null);
  const [resistance, setResistance] = useState<number | null>(null);
  const [feeling, setFeeling] = useState<Cardio['feeling']>();
  const [note, setNote] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  useEffect(() => {
    if (initialized.current || !rows) return;
    initialized.current = true;
    const last = [...rows].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (last) { setType(last.type); setMinutes(last.minutes); setSpeed(last.speedKmh ?? null); setIncline(last.inclinePct ?? null); setResistance(last.resistance ?? null); }
    setReady(true);
  }, [rows]);
  const valid = minutes != null && minutes > 0 && minutes <= 1440 &&
    [km, kcal, speed, incline, resistance].every((v) => v == null || Number.isFinite(v) && v >= 0) &&
    (km == null || km <= 1000) && (kcal == null || kcal <= 10000) &&
    (speed == null || speed <= LIMITS.cardioSpeed[1]) && (incline == null || incline <= LIMITS.cardioIncline[1]) && (resistance == null || resistance <= LIMITS.cardioResistance[1]) &&
    (date == null || isValidDay(date) && date <= today);
  async function add() {
    if (!valid || busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      await saveCardio({ id: editing ?? undefined, date: date ?? today, type, minutes: minutes!, distanceKm: km, kcal, note: note.trim(),
        speedKmh: speed, inclinePct: incline, resistance, feeling });
      setKm(null); setKcal(null); setNote(''); setFeeling(undefined); setEditing(null);
      toast(editing ? '已更新有氧紀錄' : '已記錄有氧');
    } catch { toast('儲存失敗，輸入仍保留，請重試', { tone: 'error' }); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const weekMinutes = (rows ?? []).filter((r) => r.date > addDays(today, -7) && r.date <= today).reduce((a, r) => a + r.minutes, 0);
  if (!ready) return <div aria-busy="true"><PageHeader title="有氧紀錄" back="/train" /><p className="text-chalk-3">正在帶入上次設定…</p></div>;
  return <div className="flex flex-col gap-6 pb-6">
    <PageHeader title="有氧紀錄" back="/train" sub={'近 7 天 ' + fmt(weekMinutes, 0) + ' 分鐘'} />
    <div className="card flex flex-col gap-4 p-4">
      {editing && <p className="text-warn">正在修改既有紀錄</p>}
      <Field label="類型"><div className="flex flex-wrap gap-2">{CARDIO_TYPES.map((t) => <button type="button" key={t} aria-pressed={type === t}
        className={'press min-h-11 rounded-full border px-3 text-sm ' + (type === t ? 'border-chalk bg-chalk text-on-chalk' : 'border-seam text-chalk-2')} onClick={() => {
          setType(t); const last = rows?.find((r) => r.type === t);
          if (last && !editing) { setMinutes(last.minutes); setSpeed(last.speedKmh ?? null); setIncline(last.inclinePct ?? null); setResistance(last.resistance ?? null); }
        }}>{t}</button>)}</div></Field>
      <Field label="分鐘"><NumberInput ariaLabel="分鐘" value={minutes} decimals={0} min={1} max={1440} clamp={false} stepper onChange={setMinutes} />
        <div className="flex gap-2">{[15, 20, 30, 45].map((m) => <button type="button" key={m} className="press min-h-11 flex-1 rounded-md bg-well text-sm" onClick={() => setMinutes(m)}>{m} 分</button>)}</div></Field>
      <details open={editing != null}><summary className="press min-h-11 cursor-pointer py-2 text-chalk-2">距離、器械設定與感受（選填）</summary>
        <div className="mt-3 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="距離"><NumberInput ariaLabel="距離" value={km} min={0} max={1000} clamp={false} suffix="km" onChange={setKm} /></Field>
            <Field label="速度"><NumberInput ariaLabel="速度" value={speed} min={0} max={LIMITS.cardioSpeed[1]} clamp={false} suffix="km/h" onChange={setSpeed} /></Field>
            <Field label="坡度"><NumberInput ariaLabel="坡度" value={incline} min={0} max={LIMITS.cardioIncline[1]} clamp={false} suffix="%" onChange={setIncline} /></Field>
            <Field label="阻力"><NumberInput ariaLabel="阻力" value={resistance} min={0} max={LIMITS.cardioResistance[1]} clamp={false} onChange={setResistance} /></Field>
            <Field label="消耗熱量"><NumberInput ariaLabel="消耗熱量" value={kcal} min={0} max={10000} clamp={false} decimals={0} suffix="kcal" onChange={setKcal} /></Field>
          </div>
          <Field label="感受"><div className="flex gap-2">{(['輕鬆', '適中', '吃力'] as const).map((v) => <button type="button" key={v} aria-pressed={feeling === v} className={'press min-h-11 flex-1 rounded-md border px-2 ' + (feeling === v ? 'border-chalk text-chalk' : 'border-seam text-chalk-3')} onClick={() => setFeeling(feeling === v ? undefined : v)}>{v}</button>)}</div></Field>
          <TextField label="備註" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        </div>
      </details>
      <Field label="日期"><input aria-label="日期" type="date" className="field" value={date ?? today} max={today} aria-invalid={(date != null && (!isValidDay(date) || date > today)) || undefined} onChange={(e) => setDate(e.target.value || null)} /></Field>
      <Button variant="primary" size="lg" block disabled={!valid || busy} onClick={() => void add()}>{busy ? '儲存中…' : editing ? '更新紀錄' : '記錄'}</Button>
      {editing && <Button onClick={() => { setEditing(null); setDate(null); }}>取消修改</Button>}
      <p className="text-sm text-chalk-3">消耗熱量僅供紀錄，不會自動增加飲食目標。</p>
    </div>
    <WorkoutShare date={date ?? today} />
    <Section title="紀錄">
      {rows?.length === 0 && <EmptyState icon="run" title="還沒有有氧紀錄" />}
      <div className="card divide-y divide-seam">{rows?.slice(0, 60).map((r) => <div className="flex items-center gap-2 p-3" key={r.id}>
        <div className="min-w-0 flex-1"><p className="font-medium">{r.type} <span className="num font-normal text-chalk-2">{fmt(r.minutes, 0)} 分鐘</span></p>
          <p className="break-words text-sm text-chalk-3">{shortDateLabel(r.date)}{r.distanceKm != null && ' · ' + r.distanceKm + ' km'}{r.speedKmh != null && ' · ' + r.speedKmh + ' km/h'}{r.inclinePct != null && ' · 坡度 ' + r.inclinePct + '%'}{r.resistance != null && ' · 阻力 ' + r.resistance}{r.feeling && ' · ' + r.feeling}{r.note && ' · ' + r.note}</p></div>
        <Button onClick={() => { setEditing(r.id); setType(r.type); setMinutes(r.minutes); setDate(r.date); setKm(r.distanceKm); setKcal(r.kcal); setNote(r.note); setSpeed(r.speedKmh ?? null); setIncline(r.inclinePct ?? null); setResistance(r.resistance ?? null); setFeeling(r.feeling); scrollTo({ top: 0, behavior: 'smooth' }); }}>修改</Button>
        <IconButton icon="trash" label="刪除" onClick={async () => { await db.cardio.delete(r.id); toastUndo('已刪除有氧紀錄', () => db.cardio.put(r)); }} />
      </div>)}</div>
    </Section>
  </div>;
}
