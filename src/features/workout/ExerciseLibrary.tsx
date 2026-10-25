import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { EQUIPMENT, EQUIPMENT_LABEL, LOAD_TYPES, MUSCLE_LABEL, MUSCLES, type Equipment, type LoadType, type Muscle } from '../../content/types';
import { db, newId } from '../../db/db';
import { useExerciseLookup } from '../../db/repo/exercises';
import type { CustomExercise } from '../../db/schemas';
import { Button } from '../../ui/Button';
import { Field, NumberInput, Segmented, TextField } from '../../ui/Fields';
import { Icon } from '../../ui/Icon';
import { PageHeader } from '../../ui/Layout';
import { Sheet } from '../../ui/Sheet';
import { ExerciseRowContent, filterExercises, MuscleChips } from './ExercisePicker';

const LOAD_LABEL: Record<LoadType, string> = { external: '外加重量', bodyweightPlus: '體重＋負重', assisted: '輔助（體重−）', bodyweight: '純徒手' };

export default function ExerciseLibrary() {
  const navigate = useNavigate();
  const { all } = useExerciseLookup();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [creating, setCreating] = useState(false);
  const list = useMemo(() => filterExercises(all, q, muscle), [all, q, muscle]);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader
        title="動作庫"
        back="/train"
        sub={`${all.length} 個動作`}
        actions={
          <Button size="sm" icon="plus" onClick={() => setCreating(true)}>
            自建
          </Button>
        }
      />
      <div className="relative">
        <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-chalk-3" />
        <input type="search" className="field pl-9" placeholder="搜尋中文、別名或英文" value={q} onChange={(e) => setQ(e.target.value)} aria-label="搜尋動作" />
      </div>
      <MuscleChips value={muscle} onChange={setMuscle} />
      <div className="card divide-y divide-seam overflow-hidden">
        {list.map((e) => (
          <button key={e.id} type="button" onClick={() => navigate(`/train/exercise/${e.id}`)} className="press flex min-h-14 w-full items-center gap-3 px-4 text-left hover:bg-iron-2">
            <span className="min-w-0 flex-1">
              <ExerciseRowContent e={e} />
            </span>
            <Icon name="chevronRight" size={18} className="shrink-0 text-chalk-3" />
          </button>
        ))}
        {list.length === 0 && <p className="p-6 text-center text-chalk-3">找不到符合的動作。</p>}
      </div>
      {creating && <ExerciseForm onClose={() => setCreating(false)} onSaved={(id) => navigate(`/train/exercise/${id}`)} />}
    </div>
  );
}

export function ExerciseForm({ initial, onClose, onSaved }: { initial?: CustomExercise; onClose: () => void; onSaved?: (id: string) => void }) {
  const [name, setName] = useState(initial?.nameZh ?? '');
  const [equipment, setEquipment] = useState<Equipment>(initial?.equipment ?? 'machine');
  const [primary, setPrimary] = useState<Muscle[]>(initial?.primary ?? []);
  const [secondary, setSecondary] = useState<Muscle[]>(initial?.secondary ?? []);
  const [category, setCategory] = useState<'compound' | 'isolation'>(initial?.category ?? 'isolation');
  const [loadType, setLoadType] = useState<LoadType>(initial?.loadType ?? 'external');
  const [inc, setInc] = useState<number | null>(initial?.defaultIncrementKg ?? 2.5);
  const [lo, setLo] = useState<number | null>(initial?.defaultRepRange[0] ?? 8);
  const [hi, setHi] = useState<number | null>(initial?.defaultRepRange[1] ?? 12);
  const [cues, setCues] = useState(initial?.cues ?? '');
  const valid = name.trim().length > 0 && primary.length > 0 && lo != null && hi != null && lo <= hi;

  const toggle = (list: Muscle[], set: (m: Muscle[]) => void, m: Muscle) => set(list.includes(m) ? list.filter((x) => x !== m) : [...list, m]);

  async function save() {
    if (!valid) return;
    const row: CustomExercise = {
      id: initial?.id ?? `custom-${newId().slice(0, 8)}`,
      nameZh: name.trim(),
      aliases: initial?.aliases ?? [],
      nameEn: initial?.nameEn ?? '',
      primary,
      secondary: secondary.filter((m) => !primary.includes(m)),
      equipment,
      category,
      loadType,
      defaultIncrementKg: inc ?? 0,
      defaultRepRange: [Math.round(lo!), Math.round(hi!)],
      cues: cues.trim(),
      updatedAt: Date.now(),
    };
    await db.exercisesCustom.put(row);
    onSaved?.(row.id);
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={initial ? '編輯動作' : '自建動作'}
      footer={
        <Button variant="primary" size="lg" block disabled={!valid} onClick={() => void save()}>
          儲存
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="名稱" value={name} maxLength={60} placeholder="例如：器械坐姿推胸（藍色那台）" onChange={(e) => setName(e.target.value)} />
        <Field label="器材">
          <select className="field" value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
            {EQUIPMENT.map((e) => (
              <option key={e} value={e}>
                {EQUIPMENT_LABEL[e]}
              </option>
            ))}
          </select>
        </Field>
        {(
          [
            ['主要肌群', primary, setPrimary],
            ['輔助肌群（選填）', secondary, setSecondary],
          ] as const
        ).map(([label, list, set]) => (
          <Field key={label} label={label}>
            <div className="flex flex-wrap gap-1.5">
              {MUSCLES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={list.includes(m)}
                  onClick={() => toggle(list, set, m)}
                  className={`press h-8 rounded-full border px-3 text-sm ${list.includes(m) ? 'border-chalk bg-chalk text-on-chalk' : 'border-seam text-chalk-2'}`}
                >
                  {MUSCLE_LABEL[m]}
                </button>
              ))}
            </div>
          </Field>
        ))}
        <Field label="類型">
          <Segmented
            ariaLabel="動作類型"
            value={category}
            options={[
              { value: 'compound', label: '多關節' },
              { value: 'isolation', label: '單關節' },
            ]}
            onChange={setCategory}
          />
        </Field>
        <Field label="負荷計算">
          <select className="field" value={loadType} onChange={(e) => setLoadType(e.target.value as LoadType)}>
            {LOAD_TYPES.map((l) => (
              <option key={l} value={l}>
                {LOAD_LABEL[l]}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="每次加重">
            <NumberInput ariaLabel="每次加重" value={inc} decimals={2} min={0} max={20} suffix="kg" onChange={setInc} />
          </Field>
          <Field label="次數下限">
            <NumberInput ariaLabel="預設次數下限" value={lo} decimals={0} min={1} max={100} onChange={setLo} />
          </Field>
          <Field label="次數上限">
            <NumberInput ariaLabel="預設次數上限" value={hi} decimals={0} min={1} max={100} onChange={setHi} />
          </Field>
        </div>
        <Field label="動作要點（選填）">
          <textarea className="field min-h-20 py-2" maxLength={500} value={cues} onChange={(e) => setCues(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}
