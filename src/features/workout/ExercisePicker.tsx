import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { EQUIPMENT_LABEL, MUSCLE_LABEL, MUSCLES, type Muscle } from '../../content/types';
import { searchItems } from '../../core/search';
import { db } from '../../db/db';
import { useExerciseLookup, type AnyExercise } from '../../db/repo/exercises';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';

export function MuscleChips({ value, onChange }: { value: Muscle | null; onChange: (m: Muscle | null) => void }) {
  return (
    <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="肌群篩選">
      {[null, ...MUSCLES].map((m) => {
        const active = value === m;
        return (
          <button
            key={m ?? 'all'}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m)}
            className={`press h-8 shrink-0 rounded-full border px-3 text-sm font-medium ${active ? 'border-chalk bg-chalk text-on-chalk' : 'border-seam text-chalk-2 hover:bg-iron-2'}`}
          >
            {m ? MUSCLE_LABEL[m] : '全部'}
          </button>
        );
      })}
    </div>
  );
}

export function filterExercises(all: AnyExercise[], query: string, muscle: Muscle | null): AnyExercise[] {
  const byMuscle = muscle ? all.filter((e) => e.primary.includes(muscle) || e.secondary.includes(muscle)) : all;
  if (!query.trim()) {
    return muscle ? [...byMuscle].sort((a, b) => Number(b.primary.includes(muscle)) - Number(a.primary.includes(muscle))) : byMuscle;
  }
  return searchItems(
    byMuscle.map((e) => ({ ...e, name: e.nameZh, aliases: [...e.aliases, e.nameEn] })),
    query,
    80,
  );
}

export function ExerciseRowContent({ e }: { e: AnyExercise }) {
  return (
    <span className="min-w-0">
      <span className="block truncate font-medium">
        {e.nameZh}
        {e.isCustom && <span className="ml-1.5 text-cap text-chalk-4">自建</span>}
      </span>
      <span className="block truncate text-sm text-chalk-3">
        {EQUIPMENT_LABEL[e.equipment]} · {e.primary.map((m) => MUSCLE_LABEL[m]).join('、')}
      </span>
    </span>
  );
}

/** 選動作：搜尋中文名／別名／英文名，可依肌群篩選，最近用過的排前面 */
export function ExercisePicker({ open, onClose, onPick, title = '選擇動作' }: { open: boolean; onClose: () => void; onPick: (id: string) => void; title?: string }) {
  const { all } = useExerciseLookup();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const recentIds = useLiveQuery(async () => {
    const rows = await db.sets.orderBy('date').reverse().limit(300).toArray();
    rows.sort((a, b) => b.completedAt - a.completedAt);
    return [...new Set(rows.map((r) => r.exerciseId))].slice(0, 8);
  }, []);

  const list = useMemo(() => filterExercises(all, q, muscle), [all, q, muscle]);
  const recent = !q && !muscle ? (recentIds ?? []).map((id) => all.find((e) => e.id === id)).filter((e): e is AnyExercise => !!e) : [];

  const pick = (id: string) => {
    onPick(id);
    setQ('');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-chalk-4" />
          <input
            type="search"
            className="field pl-9"
            placeholder="搜尋動作，例如：臥推、RDL"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="搜尋動作"
          />
        </div>
        <MuscleChips value={muscle} onChange={setMuscle} />
        {recent.length > 0 && (
          <div className="flex flex-col">
            <p className="label px-1 pb-1">最近用過</p>
            {recent.map((e) => (
              <button key={e.id} type="button" onClick={() => pick(e.id)} className="press flex min-h-12 items-center rounded-md px-2 text-left hover:bg-iron-3">
                <ExerciseRowContent e={e} />
              </button>
            ))}
            <p className="label px-1 pt-3 pb-1">全部動作</p>
          </div>
        )}
        <div className="flex flex-col">
          {list.map((e) => (
            <button key={e.id} type="button" onClick={() => pick(e.id)} className="press flex min-h-12 items-center rounded-md px-2 text-left hover:bg-iron-3">
              <ExerciseRowContent e={e} />
            </button>
          ))}
          {list.length === 0 && <p className="py-6 text-center text-chalk-3">找不到符合的動作，可到「動作庫」自建。</p>}
        </div>
      </div>
    </Sheet>
  );
}
