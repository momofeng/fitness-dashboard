import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { CARDIO_TYPES } from '../../content';
import { addDays, shortDateLabel } from '../../core/dates';
import { fmt } from '../../core/units';
import { db, newId } from '../../db/db';
import { useSettings } from '../../db/repo/settings';
import type { Cardio } from '../../db/schemas';
import { Button, IconButton } from '../../ui/Button';
import { Field, NumberInput, TextField } from '../../ui/Fields';
import { EmptyState, PageHeader, Section } from '../../ui/Layout';
import { toastUndo } from '../../ui/toast';
import { useToday } from '../shared/useToday';

export default function CardioPage() {
  const settings = useSettings();
  const today = useToday(settings?.dayCutoffHour);
  const rows = useLiveQuery(() => db.cardio.orderBy('date').reverse().toArray(), []);
  const [type, setType] = useState<string>('快走');
  const [minutes, setMinutes] = useState<number | null>(30);
  const [km, setKm] = useState<number | null>(null);
  const [kcal, setKcal] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState<string | null>(null);

  async function add() {
    if (!minutes) return;
    const row: Cardio = { id: newId(), date: date ?? today, type, minutes, distanceKm: km, kcal, note: note.trim(), updatedAt: Date.now() };
    await db.cardio.put(row);
    setKm(null);
    setKcal(null);
    setNote('');
  }

  const weekMinutes = (rows ?? []).filter((r) => r.date > addDays(today, -7)).reduce((a, r) => a + r.minutes, 0);

  return (
    <div className="flex flex-col gap-6 pb-6">
      <PageHeader title="有氧紀錄" back="/train" sub={`近 7 天 ${fmt(weekMinutes, 0)} 分鐘`} />
      <div className="card flex flex-col gap-4 p-4">
        <Field label="類型">
          <div className="flex flex-wrap gap-1.5">
            {CARDIO_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setType(t)}
                className={`press h-9 rounded-full border px-3 text-sm ${type === t ? 'border-chalk bg-chalk text-on-chalk' : 'border-seam text-chalk-2'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="分鐘">
            <NumberInput ariaLabel="分鐘" value={minutes} decimals={0} min={1} max={1440} onChange={setMinutes} />
          </Field>
          <Field label="距離（選填）">
            <NumberInput ariaLabel="距離" value={km} decimals={2} min={0} max={1000} suffix="km" onChange={setKm} />
          </Field>
          <Field label="消耗（選填）">
            <NumberInput ariaLabel="消耗熱量" value={kcal} decimals={0} min={0} max={10000} suffix="kcal" onChange={setKcal} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="日期">
            <input type="date" className="field" value={date ?? today} max={today} onChange={(e) => setDate(e.target.value || null)} />
          </Field>
          <TextField label="備註" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button variant="primary" block disabled={!minutes} onClick={() => void add()}>
          記錄
        </Button>
        <p className="text-cap text-chalk-4">增肌期的有氧以輔助心肺為主；活動量的熱量已包含在目標 TDEE 內，記錄消耗不會自動加到飲食目標。</p>
      </div>

      <Section title="紀錄">
        {rows && rows.length === 0 && <EmptyState icon="run" title="還沒有有氧紀錄" />}
        {rows && rows.length > 0 && (
          <div className="card divide-y divide-seam overflow-hidden">
            {rows.slice(0, 60).map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {r.type} <span className="num font-normal text-chalk-2">{fmt(r.minutes, 0)} 分鐘</span>
                  </p>
                  <p className="num truncate text-sm text-chalk-3">
                    {shortDateLabel(r.date)}
                    {r.distanceKm != null && ` · ${fmt(r.distanceKm, 2)} km`}
                    {r.kcal != null && ` · ${fmt(r.kcal, 0)} kcal`}
                    {r.note && ` · ${r.note}`}
                  </p>
                </div>
                <IconButton
                  icon="trash"
                  label="刪除"
                  onClick={async () => {
                    await db.cardio.delete(r.id);
                    toastUndo('已刪除有氧紀錄', () => db.cardio.put(r));
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

