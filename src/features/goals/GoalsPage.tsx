// 目標與習慣：目標進度由資料自動算；習慣看本週完成幾天，手動習慣可直接打卡。

import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router';
import { GOAL_TYPE_LABEL, GOAL_TYPES, HABIT_RULE_LABEL, HABIT_RULES, type GoalKind, type HabitRule } from '../../content/types';
import { addDays, rangeKeys, shortDateLabel } from '../../core/dates';
import { daysLeft, goalProgress, weekCount } from '../../core/goals';
import { fmt, fromDisplayWeight, toDisplayWeight, type WeightUnit } from '../../core/units';
import { goalValueRange, LIMITS } from '../../db/limits';
import { useExerciseLookup } from '../../db/repo/exercises';
import {
  deleteGoal,
  deleteHabit,
  restoreHabit,
  saveGoal,
  saveHabit,
  setGoalStatus,
  setHabitArchived,
  toggleHabit,
  updateGoalCurrent,
  useGoals,
  useHabitLogsRange,
  useHabits,
  validateGoal,
  validateHabit,
  type GoalInput,
} from '../../db/repo/goals';
import { CIRC_LABEL, CIRCUMFERENCES, type Circumference, type Goal, type Habit } from '../../db/schemas';
import { Button, IconButton } from '../../ui/Button';
import { Field, NumberInput, TextField } from '../../ui/Fields';
import { Icon } from '../../ui/Icon';
import { EmptyState, Meter, PageHeader, Section } from '../../ui/Layout';
import { Sheet } from '../../ui/Sheet';
import { toast, toastUndo } from '../../ui/toast';
import { ExercisePicker } from '../workout/ExercisePicker';
import { useTargets } from '../shared/useToday';
import { goalCurrent, habitDoneDates, loadDayFacts } from './facts';

/** 體重、動作目標存公斤，畫面用使用者單位 */
const isWeight = (t: GoalKind) => t === 'bodyweight' || t === 'lift';
const unitOf = (g: Pick<Goal, 'type' | 'unit'>, wu: WeightUnit) => (isWeight(g.type) ? wu : g.type === 'bodyFat' ? '%' : g.type === 'circ' ? 'cm' : g.unit);
const show = (g: Pick<Goal, 'type'>, v: number, wu: WeightUnit) => (isWeight(g.type) ? toDisplayWeight(v, wu) : v);

export default function GoalsPage() {
  const { settings, today, targets } = useTargets();
  const goals = useGoals();
  const habits = useHabits();
  const [goalForm, setGoalForm] = useState<Goal | 'new' | null>(null);
  const [habitForm, setHabitForm] = useState<Habit | 'new' | null>(null);
  const [showOld, setShowOld] = useState(false);
  const currents = useLiveQuery(async () => {
    const out = new Map<string, number | null>();
    for (const g of goals ?? []) out.set(g.id, await goalCurrent(g, today));
    return out;
  }, [goals, today]);

  if (!settings || !goals || !habits) return null;
  const wu = settings.units.weight;
  const active = goals.filter((g) => g.status === 'active');
  const old = goals.filter((g) => g.status !== 'active');

  return (
    <div className="flex flex-col gap-6 pb-6">
      <PageHeader title="目標與習慣" back="/more" actions={<Link to="/calendar" className="press flex h-11 items-center gap-1 rounded-md px-3 text-sm text-chalk-2 hover:bg-iron-2">月曆</Link>} />

      <Section
        title="目標"
        action={
          <Button size="sm" icon="plus" onClick={() => setGoalForm('new')}>
            新增目標
          </Button>
        }
      >
        {active.length === 0 ? (
          <EmptyState icon="star" title="還沒有目標" body="例如：體重 75 kg、深蹲 100 kg × 5 下。進度會依你的紀錄自動更新。" />
        ) : (
          <div className="flex flex-col gap-3">
            {active.map((g) => (
              <GoalCard key={g.id} goal={g} current={currents?.get(g.id) ?? null} wu={wu} today={today} onEdit={() => setGoalForm(g)} />
            ))}
          </div>
        )}
        {old.length > 0 && (
          <button type="button" onClick={() => setShowOld((v) => !v)} className="press flex h-9 items-center gap-1 px-1 text-sm text-chalk-3">
            <Icon name={showOld ? 'chevronDown' : 'chevronRight'} size={16} />
            已完成／封存（{old.length}）
          </button>
        )}
        {showOld &&
          old.map((g) => (
            <div key={g.id} className="card flex items-center gap-3 p-3">
              <Icon name={g.status === 'done' ? 'check' : 'note'} size={18} className={g.status === 'done' ? 'text-go' : 'text-chalk-4'} />
              <p className="min-w-0 flex-1 truncate text-sm">{g.title}</p>
              <Button size="sm" variant="ghost" onClick={() => void setGoalStatus(g.id, 'active')}>
                重新啟用
              </Button>
            </div>
          ))}
      </Section>

      <Section
        title="習慣"
        action={
          <Button size="sm" icon="plus" onClick={() => setHabitForm('new')}>
            新增習慣
          </Button>
        }
      >
        <HabitList habits={habits} today={today} weekStart={settings.weekStart} targets={{ proteinG: targets?.protein ?? null, waterMl: settings.nutrition.waterTargetMl }} onEdit={setHabitForm} />
        {habits.some((h) => h.archived) && (
          <div className="flex flex-col gap-1 px-1">
            <p className="label">已封存</p>
            {habits
              .filter((h) => h.archived)
              .map((h) => (
                <div key={h.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-chalk-3">{h.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => void setHabitArchived(h.id, false)}>
                    恢復
                  </Button>
                </div>
              ))}
          </div>
        )}
      </Section>

      {goalForm && <GoalForm initial={goalForm === 'new' ? null : goalForm} wu={wu} today={today} onClose={() => setGoalForm(null)} />}
      {habitForm && <HabitForm initial={habitForm === 'new' ? null : habitForm} existing={habits} onClose={() => setHabitForm(null)} />}
    </div>
  );
}

function GoalCard({ goal: g, current, wu, today, onEdit }: { goal: Goal; current: number | null; wu: WeightUnit; today: string; onEdit: () => void }) {
  const { get } = useExerciseLookup();
  const p = goalProgress(g.startValue, g.targetValue, current);
  const u = unitOf(g, wu);
  const left = daysLeft(g.dueDate, today);
  const [editing, setEditing] = useState(false);
  const [cur, setCur] = useState<number | null>(g.current);
  return (
    <section className="card flex flex-col gap-2 p-4" aria-label={g.title}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{g.title}</p>
          <p className="text-sm text-chalk-3">
            {GOAL_TYPE_LABEL[g.type]}
            {g.type === 'lift' && g.exerciseId && ` · ${get(g.exerciseId)?.nameZh ?? ''} × ${g.targetReps} 下`}
            {g.type === 'circ' && g.circ && ` · ${CIRC_LABEL[g.circ]}`}
            {left != null && ` · ${left >= 0 ? `還有 ${left} 天` : `已過期 ${-left} 天`}`}
          </p>
        </div>
        <IconButton icon="edit" label={`編輯 ${g.title}`} onClick={onEdit} />
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="num text-h3 font-semibold">
          {current != null ? fmt(show(g, current, wu), 1) : '–'}
          <span className="ml-1 text-sm font-normal text-chalk-3">
            / {fmt(show(g, g.targetValue, wu), 1)} {u}
          </span>
        </p>
        <p className="num text-sm text-chalk-3">{p.pct != null ? `${Math.round(p.pct * 100)}%` : '還沒有資料'}</p>
      </div>
      <Meter value={(p.pct ?? 0) * 100} max={100} label={`${g.title} 進度`} color={p.done ? 'var(--go)' : 'var(--chalk)'} />
      {p.done ? (
        <div className="flex items-center gap-2">
          <p className="flex flex-1 items-center gap-1 text-sm font-medium text-go">
            <Icon name="check" size={16} />
            達成了！
          </p>
          <Button size="sm" variant="go" onClick={() => void setGoalStatus(g.id, 'done').then(() => toast('已標為完成'))}>
            標為完成
          </Button>
        </div>
      ) : (
        p.remaining != null && (
          <p className="text-sm text-chalk-3">
            還差 {fmt(show(g, p.remaining, wu), 1)} {u}
          </p>
        )
      )}
      {g.type === 'custom' &&
        (editing ? (
          <div className="flex items-center gap-2">
            <NumberInput ariaLabel="目前值" value={cur} decimals={2} min={LIMITS.customGoal[0]} max={LIMITS.customGoal[1]} clamp={false} className="flex-1" onChange={setCur} />
            <Button
              size="sm"
              variant="primary"
              onClick={() =>
                void updateGoalCurrent(g.id, cur)
                  .then(() => setEditing(false))
                  .catch((e: unknown) => toast(e instanceof Error ? e.message : String(e), { tone: 'error' }))
              }
            >
              更新
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setEditing(true)}>
            更新目前值
          </Button>
        ))}
    </section>
  );
}

function HabitList({
  habits,
  today,
  weekStart,
  targets,
  onEdit,
}: {
  habits: Habit[];
  today: string;
  weekStart: 0 | 1;
  targets: { proteinG: number | null; waterMl: number };
  onEdit: (h: Habit) => void;
}) {
  const from = addDays(today, -13);
  const logs = useHabitLogsRange(from, today);
  const facts = useLiveQuery(() => loadDayFacts(from, today), [from, today]);
  const active = habits.filter((h) => !h.archived);
  if (active.length === 0) return <EmptyState icon="check" title="還沒有習慣" body="例如：每天量體重、蛋白質達標、睡滿 7 小時。自動判定的習慣不用手動打卡。" />;
  if (!logs || !facts) return <div aria-busy="true" className="h-20" />;
  const manual = new Set(logs.map((l) => l.id));
  const last7 = rangeKeys(addDays(today, -6), today);
  return (
    <div className="card divide-y divide-seam overflow-hidden">
      {active.map((h) => {
        const done = habitDoneDates(h, facts, manual, targets);
        const week = weekCount(done, today, weekStart);
        const doneToday = done.has(today);
        return (
          <div key={h.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{h.name}</p>
              <p className="text-sm text-chalk-3">
                {HABIT_RULE_LABEL[h.rule]} · 本週 {week}/{h.perWeek}
                {week >= h.perWeek && ' ✓'}
              </p>
              <div className="mt-1.5 flex gap-1" aria-label={`近 7 天：${last7.map((d) => (done.has(d) ? '完成' : '未完成')).join('、')}`}>
                {last7.map((d) => (
                  <span key={d} title={`${shortDateLabel(d)}：${done.has(d) ? '完成' : '未完成'}`} className={`h-2 w-5 rounded-full ${done.has(d) ? 'bg-go' : 'bg-iron-3'}`} />
                ))}
              </div>
            </div>
            {h.rule === 'manual' ? (
              <button
                type="button"
                aria-pressed={doneToday}
                aria-label={`今天完成：${h.name}`}
                onClick={() => void toggleHabit(h.id, today)}
                className={`press flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${doneToday ? 'bg-go text-on-chalk' : 'border border-seam bg-iron-2 text-chalk-3'}`}
              >
                <Icon name="check" size={20} strokeWidth={2.4} />
              </button>
            ) : (
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center ${doneToday ? 'text-go' : 'text-chalk-4'}`} aria-label={doneToday ? '今天已達成' : '今天尚未達成'} role="img">
                <Icon name={doneToday ? 'check' : 'minus'} size={20} />
              </span>
            )}
            <IconButton icon="more" label={`${h.name} 選項`} onClick={() => onEdit(h)} />
          </div>
        );
      })}
      <p className="px-4 py-2 text-cap text-chalk-4">自動判定：蛋白質達目標 95% 以上、喝水達目標、睡眠 7 小時以上算完成。本週從{weekStart === 1 ? '週一' : '週日'}起算。</p>
    </div>
  );
}

// ---------- 表單 ----------

function GoalForm({ initial, wu, today, onClose }: { initial: Goal | null; wu: WeightUnit; today: string; onClose: () => void }) {
  const { get } = useExerciseLookup();
  const [type, setType] = useState<GoalKind>(initial?.type ?? 'bodyweight');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [exerciseId, setExerciseId] = useState<string | null>(initial?.exerciseId ?? null);
  const [reps, setReps] = useState<number | null>(initial?.targetReps ?? 5);
  const [circ, setCirc] = useState<Circumference>(initial?.circ ?? 'waist');
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const toShow = (v: number | null | undefined, t: GoalKind) => (v == null ? null : isWeight(t) ? Number(toDisplayWeight(v, wu).toFixed(2)) : v);
  const [target, setTarget] = useState<number | null>(toShow(initial?.targetValue, initial?.type ?? 'bodyweight'));
  const [start, setStart] = useState<number | null>(initial?.type === 'custom' ? (initial.startValue ?? null) : null);
  const [due, setDue] = useState(initial?.dueDate ?? '');
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toKg = (v: number | null) => (v == null ? null : isWeight(type) ? fromDisplayWeight(v, wu) : v);
  const [lo, hi] = goalValueRange(type);
  const shownRange = isWeight(type) ? [toDisplayWeight(lo, wu), toDisplayWeight(hi, wu)] : [lo, hi];
  const u = unitOf({ type, unit }, wu);
  const autoTitle = () => {
    if (target == null) return '';
    const v = `${fmt(target, 1)} ${u}`.trim();
    if (type === 'lift') return `${exerciseId ? (get(exerciseId)?.nameZh ?? '') : '動作'} ${v} × ${reps ?? ''} 下`;
    if (type === 'circ') return `${CIRC_LABEL[circ]} ${v}`;
    return `${GOAL_TYPE_LABEL[type]} ${v}`;
  };
  const draft = (): GoalInput => ({
    id: initial?.id,
    type,
    title: (title.trim() || autoTitle()).slice(0, 60),
    exerciseId: type === 'lift' ? exerciseId : null,
    targetReps: type === 'lift' ? reps : null,
    circ: type === 'circ' ? circ : null,
    unit: type === 'custom' ? unit.trim().slice(0, 10) : '',
    startValue: initial?.startValue ?? null,
    targetValue: toKg(target) ?? Number.NaN,
    current: type === 'custom' ? (initial?.current ?? start) : null,
    dueDate: due || null,
  });
  const error = target == null ? '請輸入目標值' : validateGoal(draft());

  async function save() {
    const d = draft();
    if (error) return;
    setBusy(true);
    try {
      // 起始值：新目標以目前的紀錄為起點，進度從 0% 開始
      if (!initial) d.startValue = type === 'custom' ? start : await goalCurrent(d, today);
      if (initial && initial.type !== type) d.startValue = type === 'custom' ? start : await goalCurrent(d, today);
      await saveGoal(d);
      toast(initial ? '已更新目標' : '已新增目標');
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={initial ? '編輯目標' : '新增目標'}
      footer={
        <Button variant="primary" block disabled={!!error || busy} onClick={() => void save()}>
          儲存
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="目標類型">
          {GOAL_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => {
                setType(t);
                setTarget(null);
              }}
              className={`press h-9 rounded-full border px-3 text-sm ${type === t ? 'border-chalk bg-chalk font-medium text-on-chalk' : 'border-seam text-chalk-2'}`}
            >
              {GOAL_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        {type === 'lift' && (
          <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
            <Field label="動作">
              <button type="button" onClick={() => setPicking(true)} className="field flex items-center justify-between gap-2 text-left">
                <span className="truncate">{exerciseId ? get(exerciseId)?.nameZh : '選擇動作'}</span>
                <Icon name="chevronRight" size={16} className="shrink-0 text-chalk-4" />
              </button>
            </Field>
            <Field label="次數">
              <NumberInput ariaLabel="目標次數" value={reps} decimals={0} min={LIMITS.targetReps[0]} max={LIMITS.targetReps[1]} clamp={false} suffix="下" onChange={setReps} />
            </Field>
          </div>
        )}
        {type === 'circ' && (
          <Field label="部位">
            <select className="field" value={circ} onChange={(e) => setCirc(e.target.value as Circumference)} aria-label="圍度部位">
              {CIRCUMFERENCES.map((c) => (
                <option key={c} value={c}>
                  {CIRC_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={`目標值${u ? `（${u}）` : ''}`} error={target != null && error?.startsWith('目標值') ? `請輸入 ${fmt(shownRange[0]!, 1)}–${fmt(shownRange[1]!, 1)}` : null}>
            <NumberInput ariaLabel="目標值" value={target} decimals={2} min={shownRange[0]} max={shownRange[1]} clamp={false} onChange={setTarget} />
          </Field>
          {type === 'custom' ? (
            <Field label="單位">
              <input className="field" value={unit} maxLength={10} placeholder="例如：下、公里" onChange={(e) => setUnit(e.target.value)} aria-label="單位" />
            </Field>
          ) : (
            <Field label="期限（選填）">
              <input type="date" className="field" value={due} min={today} onChange={(e) => setDue(e.target.value)} aria-label="期限" />
            </Field>
          )}
        </div>
        {type === 'custom' && !initial && (
          <Field label="起始值（選填）">
            <NumberInput ariaLabel="起始值" value={start} decimals={2} min={LIMITS.customGoal[0]} max={LIMITS.customGoal[1]} clamp={false} onChange={setStart} />
          </Field>
        )}
        <TextField label="名稱（選填）" value={title} maxLength={60} placeholder={autoTitle() || '例如：年底前體重 75 kg'} onChange={(e) => setTitle(e.target.value)} />
        {error && target != null && <p className="text-sm text-danger">{error}</p>}
        {!initial && type !== 'custom' && <p className="text-cap text-chalk-4">起點會用你目前的紀錄，之後依新紀錄自動更新進度。</p>}
        {initial && (
          <div className="grid grid-cols-2 gap-2 border-t border-seam pt-4">
            <Button onClick={() => void setGoalStatus(initial.id, 'archived').then(onClose)}>封存</Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={async () => {
                if (!confirmDelete) return setConfirmDelete(true);
                const g = await deleteGoal(initial.id);
                onClose();
                if (g) toastUndo(`已刪除「${g.title}」`, () => saveGoal(g));
              }}
            >
              {confirmDelete ? '確定刪除' : '刪除'}
            </Button>
          </div>
        )}
      </div>
      <ExercisePicker open={picking} onClose={() => setPicking(false)} title="選擇動作" onPick={(id) => setExerciseId(id)} />
    </Sheet>
  );
}

const HABIT_PRESETS: Array<{ name: string; rule: HabitRule; perWeek: number }> = [
  { name: '每天量體重', rule: 'weighIn', perWeek: 7 },
  { name: '蛋白質達標', rule: 'protein', perWeek: 6 },
  { name: '喝水達標', rule: 'water', perWeek: 6 },
  { name: '睡滿 7 小時', rule: 'sleep', perWeek: 5 },
  { name: '補給品打卡', rule: 'supplement', perWeek: 7 },
  { name: '記錄飲食', rule: 'logFood', perWeek: 7 },
];

function HabitForm({ initial, existing, onClose }: { initial: Habit | null; existing: Habit[]; onClose: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [rule, setRule] = useState<HabitRule>(initial?.rule ?? 'manual');
  const [perWeek, setPerWeek] = useState<number | null>(initial?.perWeek ?? 7);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const input = { id: initial?.id, name, rule, perWeek: perWeek ?? 0 };
  const error = validateHabit(input);
  const presets = HABIT_PRESETS.filter((p) => !existing.some((h) => h.rule === p.rule && !h.archived));

  return (
    <Sheet
      open
      onClose={onClose}
      title={initial ? '編輯習慣' : '新增習慣'}
      footer={
        <Button
          variant="primary"
          block
          disabled={!!error}
          onClick={() =>
            void saveHabit(input)
              .then(() => {
                toast(initial ? '已更新習慣' : '已新增習慣');
                onClose();
              })
              .catch((e: unknown) => toast(e instanceof Error ? e.message : String(e), { tone: 'error' }))
          }
        >
          儲存
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {!initial && presets.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-chalk-2">常用（自動判定）</p>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.rule}
                  type="button"
                  onClick={() => {
                    setName(p.name);
                    setRule(p.rule);
                    setPerWeek(p.perWeek);
                  }}
                  className="press h-9 rounded-full border border-seam px-3 text-sm text-chalk-2 hover:bg-iron-2"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <TextField label="名稱" value={name} maxLength={40} placeholder="例如：睡前伸展 10 分鐘" onChange={(e) => setName(e.target.value)} />
        <Field label="怎麼算完成">
          <select className="field" value={rule} onChange={(e) => setRule(e.target.value as HabitRule)} aria-label="判定方式">
            {HABIT_RULES.map((r) => (
              <option key={r} value={r}>
                {HABIT_RULE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="每週目標" error={perWeek != null && error?.includes('每週') ? error : null}>
          <NumberInput ariaLabel="每週幾天" value={perWeek} decimals={0} min={LIMITS.habitPerWeek[0]} max={LIMITS.habitPerWeek[1]} clamp={false} stepper suffix="天" onChange={setPerWeek} />
        </Field>
        {initial && (
          <div className="grid grid-cols-2 gap-2 border-t border-seam pt-4">
            <Button onClick={() => void setHabitArchived(initial.id, true).then(onClose)}>封存</Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={async () => {
                if (!confirmDelete) return setConfirmDelete(true);
                const removed = await deleteHabit(initial.id);
                onClose();
                if (removed) toastUndo(`已刪除「${removed.habit.name}」`, () => restoreHabit(removed));
              }}
            >
              {confirmDelete ? '確定刪除（含打卡紀錄）' : '刪除'}
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
