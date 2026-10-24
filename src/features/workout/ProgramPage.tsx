import { useState } from 'react';
import { PROGRAM_TEMPLATES } from '../../content/programTemplates';
import type { ProgramSlot } from '../../content/types';
import { programWeeklyVolume } from '../../core/training/volume';
import { newId } from '../../db/db';
import { useExerciseLookup } from '../../db/repo/exercises';
import { activateTemplate, deleteProgram, saveProgram, setActiveProgram, useActiveProgram, usePrograms } from '../../db/repo/programs';
import { useSettings } from '../../db/repo/settings';
import type { Program } from '../../db/schemas';
import { Button, IconButton } from '../../ui/Button';
import { Field, NumberInput, Segmented, TextField } from '../../ui/Fields';
import { Icon } from '../../ui/Icon';
import { PageHeader, Section } from '../../ui/Layout';
import { Sheet } from '../../ui/Sheet';
import { toast, toastUndo } from '../../ui/toast';
import { ExercisePicker } from './ExercisePicker';
import { VolumeList } from './VolumeList';

export default function ProgramPage() {
  const settings = useSettings();
  const active = useActiveProgram();
  const programs = usePrograms();
  const { get } = useExerciseLookup();
  const [edit, setEdit] = useState<{ day: number; slot: number } | null>(null);
  const [addTo, setAddTo] = useState<number | null>(null);
  const [confirmTpl, setConfirmTpl] = useState<string | null>(null);

  if (!settings || active === undefined || !programs) return null;
  const others = programs.filter((p) => p.id !== active?.id);

  const update = (p: Program) => saveProgram(p);
  const patchSlot = (dayIdx: number, slotIdx: number, patch: Partial<ProgramSlot> | null) => {
    if (!active) return;
    const days = active.days.map((d, i) =>
      i !== dayIdx ? d : { ...d, slots: patch === null ? d.slots.filter((_, j) => j !== slotIdx) : d.slots.map((s, j) => (j === slotIdx ? { ...s, ...patch } : s)) },
    );
    void update({ ...active, days });
  };
  const moveSlot = (dayIdx: number, slotIdx: number, dir: -1 | 1) => {
    if (!active) return;
    const slots = [...active.days[dayIdx]!.slots];
    const j = slotIdx + dir;
    if (j < 0 || j >= slots.length) return;
    [slots[slotIdx], slots[j]] = [slots[j]!, slots[slotIdx]!];
    void update({ ...active, days: active.days.map((d, i) => (i === dayIdx ? { ...d, slots } : d)) });
  };

  const editing = edit && active ? active.days[edit.day]?.slots[edit.slot] : undefined;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <PageHeader title="課表" back="/train" />

      {active ? (
        <>
          <div className="card flex flex-col gap-3 p-4">
            <TextField label="課表名稱" value={active.name} maxLength={60} onChange={(e) => void update({ ...active, name: e.target.value || '我的課表' })} />
            <Field label="每週練幾天" hint="用來估算每週組數與本週進度">
              <NumberInput ariaLabel="每週天數" value={active.daysPerWeek} decimals={0} min={1} max={7} stepper onChange={(v) => v != null && void update({ ...active, daysPerWeek: Math.round(v) })} />
            </Field>
          </div>

          {active.days.map((day, di) => (
            <Section
              key={day.id}
              title={`${di === active.nextDayIndex % active.days.length ? '▶ 下一次 · ' : ''}第 ${di + 1} 天`}
              action={
                active.days.length > 1 && (
                  <button
                    type="button"
                    className="text-sm text-chalk-4 hover:text-danger"
                    onClick={() => {
                      const prev = active;
                      void update({ ...active, days: active.days.filter((_, i) => i !== di), nextDayIndex: 0 });
                      toastUndo(`已刪除「${day.name}」`, () => update(prev));
                    }}
                  >
                    刪除這天
                  </button>
                )
              }
            >
              <div className="card overflow-hidden">
                <div className="border-b border-seam p-3">
                  <input
                    aria-label="訓練日名稱"
                    className="field h-10 font-semibold"
                    value={day.name}
                    maxLength={40}
                    onChange={(e) => void update({ ...active, days: active.days.map((d, i) => (i === di ? { ...d, name: e.target.value || `第 ${di + 1} 天` } : d)) })}
                  />
                </div>
                <ol className="divide-y divide-seam">
                  {day.slots.map((s, si) => (
                    <li key={`${s.exerciseId}-${si}`} className="flex items-center gap-1 pr-1">
                      <button type="button" onClick={() => setEdit({ day: di, slot: si })} className="press flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 text-left hover:bg-iron-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{get(s.exerciseId)?.nameZh ?? s.exerciseId}</span>
                          <span className="num block text-sm text-chalk-3">
                            {s.sets} × {s.repMin === s.repMax ? s.repMax : `${s.repMin}–${s.repMax}`} · 休 {s.restSec}s · {s.progression === 'linear' ? '線性進步' : s.progression === 'double' ? '雙重進步' : '不追蹤'}
                          </span>
                        </span>
                      </button>
                      <IconButton icon="chevronLeft" label="上移" size={36} className="rotate-90" onClick={() => moveSlot(di, si, -1)} disabled={si === 0} />
                      <IconButton icon="chevronRight" label="下移" size={36} className="rotate-90" onClick={() => moveSlot(di, si, 1)} disabled={si === day.slots.length - 1} />
                    </li>
                  ))}
                </ol>
                <button type="button" onClick={() => setAddTo(di)} className="press flex h-12 w-full items-center justify-center gap-1 border-t border-seam text-sm font-medium text-chalk-3 hover:bg-iron-2">
                  <Icon name="plus" size={16} />
                  新增動作
                </button>
              </div>
            </Section>
          ))}

          <Button
            icon="plus"
            block
            onClick={() => void update({ ...active, days: [...active.days, { id: newId().slice(0, 8), name: `第 ${active.days.length + 1} 天`, slots: [] }] })}
          >
            新增訓練日
          </Button>

          <Section title="每週組數估算">
            <div className="card p-4">
              <VolumeList
                volume={programWeeklyVolume(active, (id) => get(id))}
                min={settings.training.volumeMin}
                max={settings.training.volumeMax}
                scaleNote={`依每週 ${active.daysPerWeek} 天、${active.days.length} 個訓練日輪替估算。`}
              />
            </div>
          </Section>
        </>
      ) : (
        <p className="px-1 text-chalk-3">目前沒有使用中的課表，從下方選一份範本開始。</p>
      )}

      {others.length > 0 && (
        <Section title="我的其他課表">
          <div className="card divide-y divide-seam overflow-hidden">
            {others.map((p) => (
              <div key={p.id} className="flex items-center gap-2 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-sm text-chalk-3">{p.days.length} 個訓練日 · 每週 {p.daysPerWeek} 天</p>
                </div>
                <Button size="sm" onClick={() => void setActiveProgram(p.id)}>
                  使用
                </Button>
                <IconButton
                  icon="trash"
                  label={`刪除 ${p.name}`}
                  onClick={() => {
                    void deleteProgram(p.id);
                    toastUndo(`已刪除「${p.name}」`, () => saveProgram(p));
                  }}
                />
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="課表範本">
        <div className="flex flex-col gap-2">
          {PROGRAM_TEMPLATES.map((t) => (
            <div key={t.id} className="card flex flex-col gap-2 p-4">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 font-semibold">{t.name}</p>
                <span className="num text-sm text-chalk-3">每週 {t.daysPerWeek} 天</span>
              </div>
              <p className="text-sm text-chalk-3">{t.description}</p>
              <Button size="sm" className="self-start" onClick={() => setConfirmTpl(t.id)}>
                套用這份範本
              </Button>
            </div>
          ))}
        </div>
      </Section>

      <ExercisePicker
        open={addTo != null}
        onClose={() => setAddTo(null)}
        onPick={(exId) => {
          if (!active || addTo == null) return;
          const ex = get(exId);
          const [lo, hi] = ex?.defaultRepRange ?? [8, 12];
          const slot: ProgramSlot = { exerciseId: exId, sets: 3, repMin: lo, repMax: hi, restSec: ex?.category === 'compound' ? 150 : 90, progression: 'double' };
          void update({ ...active, days: active.days.map((d, i) => (i === addTo ? { ...d, slots: [...d.slots, slot] } : d)) });
        }}
      />

      <Sheet open={!!editing} onClose={() => setEdit(null)} title={editing ? (get(editing.exerciseId)?.nameZh ?? '動作') : ''}>
        {editing && edit && (
          <div className="flex flex-col gap-4">
            <Field label="進步方式">
              <Segmented
                ariaLabel="進步方式"
                value={editing.progression}
                options={[
                  { value: 'linear', label: '線性' },
                  { value: 'double', label: '雙重' },
                  { value: 'none', label: '不追蹤' },
                ]}
                onChange={(v) => patchSlot(edit.day, edit.slot, v === 'linear' ? { progression: v, repMin: editing.repMax } : { progression: v })}
              />
            </Field>
            <p className="text-sm text-chalk-3">
              {editing.progression === 'linear'
                ? '每組都做到目標次數就加重；連續失敗會自動減量。適合新手的大重量主項。'
                : editing.progression === 'double'
                  ? '先在次數區間內加次數，每組都做到上限再加重。適合輔助動作。'
                  : '只記錄，不給加重建議。'}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="組數">
                <NumberInput ariaLabel="組數" value={editing.sets} decimals={0} min={1} max={20} onChange={(v) => v != null && patchSlot(edit.day, edit.slot, { sets: Math.round(v) })} />
              </Field>
              <Field label={editing.progression === 'linear' ? '目標次數' : '次數下限'}>
                <NumberInput
                  ariaLabel="次數下限"
                  value={editing.progression === 'linear' ? editing.repMax : editing.repMin}
                  decimals={0}
                  min={1}
                  max={100}
                  onChange={(v) => {
                    if (v == null) return;
                    const n = Math.round(v);
                    patchSlot(edit.day, edit.slot, editing.progression === 'linear' ? { repMin: n, repMax: n } : { repMin: n, repMax: Math.max(n, editing.repMax) });
                  }}
                />
              </Field>
              {editing.progression !== 'linear' && (
                <Field label="次數上限">
                  <NumberInput ariaLabel="次數上限" value={editing.repMax} decimals={0} min={1} max={100} onChange={(v) => v != null && patchSlot(edit.day, edit.slot, { repMax: Math.max(Math.round(v), editing.repMin) })} />
                </Field>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="休息（秒）">
                <NumberInput ariaLabel="休息秒數" value={editing.restSec} step={15} decimals={0} min={0} max={900} stepper onChange={(v) => v != null && patchSlot(edit.day, edit.slot, { restSec: Math.round(v) })} />
              </Field>
              <Field label="每次加重（kg）" hint={`預設 ${get(editing.exerciseId)?.defaultIncrementKg ?? 2.5}`}>
                <NumberInput ariaLabel="每次加重" value={editing.incrementKg ?? null} decimals={2} min={0} max={20} placeholder="預設" onChange={(v) => patchSlot(edit.day, edit.slot, { incrementKg: v ?? undefined })} />
              </Field>
            </div>
            <Button
              variant="danger"
              icon="trash"
              block
              onClick={() => {
                patchSlot(edit.day, edit.slot, null);
                setEdit(null);
              }}
            >
              從這天移除
            </Button>
          </div>
        )}
      </Sheet>

      <Sheet
        open={confirmTpl != null}
        onClose={() => setConfirmTpl(null)}
        title="套用範本？"
        footer={
          <div className="flex gap-2">
            <Button block onClick={() => setConfirmTpl(null)}>
              取消
            </Button>
            <Button
              variant="primary"
              block
              onClick={async () => {
                if (!confirmTpl) return;
                await activateTemplate(confirmTpl);
                setConfirmTpl(null);
                toast('已套用新課表');
              }}
            >
              套用
            </Button>
          </div>
        }
      >
        <p className="text-chalk-2">會建立一份新的課表並設為目前課表。{active ? '目前的課表會保留在「我的其他課表」。' : ''}各動作的工作重量會沿用。</p>
      </Sheet>
    </div>
  );
}
