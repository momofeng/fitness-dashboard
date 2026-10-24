import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '../../content/types';
import { roundingStepFor } from '../../core/training/progression';
import { warmupSets } from '../../core/training/strength';
import { tonnage } from '../../core/training/volume';
import { fmt, fromDisplayWeight, toDisplayWeight } from '../../core/units';
import { db } from '../../db/db';
import { smallestPlateKg } from '../../db/defaults';
import { LIMITS } from '../../db/limits';
import { useExerciseLookup, type AnyExercise } from '../../db/repo/exercises';
import { useSettings } from '../../db/repo/settings';
import {
  addExerciseToWorkout,
  deleteSet,
  discardWorkout,
  finishWorkout,
  lastSessionSets,
  logSet,
  removePlanItem,
  restorePlanItem,
  restoreSet,
  swapPlanExercise,
  updatePlanItem,
  updateSet,
  useWorkout,
  useWorkoutSets,
  type FinishResult,
} from '../../db/repo/workouts';
import type { PlanItem, Settings, Workout, WorkoutSet } from '../../db/schemas';
import { keepAwake, unlockAudio } from '../../lib/platform';
import { Button, IconButton } from '../../ui/Button';
import { Field, NumberInput } from '../../ui/Fields';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { toast, toastUndo } from '../../ui/toast';
import { ExercisePicker } from './ExercisePicker';
import { PlateBar, PlateCalculator } from './PlateBar';
import { RestTimer } from './RestTimer';

const BARBELL = new Set(['barbell', 'smith', 'ezbar']);

function elapsedText(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export default function LiveWorkout() {
  const { id } = useParams();
  const workout = useWorkout(id);
  const sets = useWorkoutSets(id);
  const settings = useSettings();
  const lookup = useExerciseLookup();
  const [result, setResult] = useState<FinishResult | null>(null);
  const [finishing, setFinishing] = useState(false);

  if (workout === undefined || sets === undefined || !settings || !lookup.ready) return <div className="min-h-dvh bg-floor" aria-busy="true" />;
  if (workout === null) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-h3 font-semibold">找不到這場訓練</p>
        <Link to="/train" className="press inline-flex h-11 items-center rounded-md bg-chalk px-4 font-semibold text-on-chalk">
          回訓練頁
        </Link>
      </div>
    );
  }
  if (workout.status === 'done') {
    if (result) return <FinishResultView workoutId={workout.id} result={result} get={lookup.get} />;
    // 剛按下完成、結果還在路上：先不要跳走
    if (finishing) return <div className="min-h-dvh bg-floor" aria-busy="true" />;
    return <Navigate to={`/train/history/${workout.id}`} replace />;
  }
  return <Session workout={workout} sets={sets} settings={settings} get={lookup.get} onFinishing={() => setFinishing(true)} onFinished={setResult} />;
}

/** 完成後的結果：新紀錄與下次怎麼練 */
function FinishResultView({ workoutId, result, get }: { workoutId: string; result: FinishResult; get: (id: string) => AnyExercise | undefined }) {
  const navigate = useNavigate();
  const go = () => navigate(`/train/history/${workoutId}`, { replace: true });
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-4 pt-[max(24px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
      <div>
        <p className="label">訓練完成</p>
        <h1 className="text-h1 font-semibold">做得好！</h1>
      </div>
      {result.prs.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="label">新紀錄</p>
          {result.prs.map((p) => (
            <p key={p} className="flex items-center gap-2 rounded-md bg-go-soft px-3 py-2 font-medium text-go">
              <Icon name="star" size={18} />
              {p}
            </p>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <p className="label">下次怎麼練</p>
        {result.messages.length === 0 && <p className="text-chalk-3">這場沒有需要調整重量的動作。</p>}
        {result.messages.map((m) => (
          <div key={m.exerciseId} className="card px-4 py-3">
            <p className="font-medium">{get(m.exerciseId)?.nameZh}</p>
            <p className="text-sm text-chalk-2">{m.text}</p>
          </div>
        ))}
      </div>
      <div className="mt-auto">
        <Button variant="primary" size="lg" block onClick={go}>
          查看這場紀錄
        </Button>
      </div>
    </div>
  );
}

function Session({
  workout,
  sets,
  settings,
  get,
  onFinishing,
  onFinished,
}: {
  workout: Workout;
  sets: WorkoutSet[];
  settings: Settings;
  get: (id: string) => AnyExercise | undefined;
  onFinishing: () => void;
  onFinished: (r: FinishResult) => void;
}) {
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'swap'; index: number } | null>(null);
  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!settings.training.keepAwake) return;
    void keepAwake(true);
    return () => void keepAwake(false);
  }, [settings.training.keepAwake]);

  // 下一組：第一個還沒做完的動作的下一個正式組
  const nextKey = useMemo(() => {
    for (let i = 0; i < workout.plan.length; i++) {
      const p = workout.plan[i]!;
      const done = sets.filter((s) => s.exerciseId === p.exerciseId && s.kind === 'working').length;
      const firstIndexForExercise = workout.plan.findIndex((q) => q.exerciseId === p.exerciseId);
      if (firstIndexForExercise !== i) continue;
      if (done < p.sets) return `${i}:${done}`;
    }
    return null;
  }, [workout.plan, sets]);

  const working = sets.filter((s) => s.kind === 'working');
  const plannedTotal = workout.plan.reduce((a, p) => a + p.sets, 0);

  async function onLog(item: PlanItem, values: { weightKg: number; reps: number; rir: number | null }, kind: WorkoutSet['kind'] = 'working') {
    unlockAudio();
    await logSet(workout.id, { exerciseId: item.exerciseId, kind, ...values }, kind === 'warmup' ? Math.min(60, item.restSec) : item.restSec);
  }

  async function onFinish() {
    setBusy(true);
    try {
      // 先交給外層保留結果，再寫入「已完成」，避免畫面直接跳走
      onFinishing();
      const r = await finishWorkout(workout.id);
      onFinished(r);
    } catch (e) {
      toast(`完成失敗，訓練紀錄都還在：${e instanceof Error ? e.message : e}`, { tone: 'error', ms: 8000 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-2xl px-4 pb-[calc(32px+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 -mx-4 flex h-[calc(56px+env(safe-area-inset-top))] items-center gap-2 border-b border-seam bg-floor/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur">
        <IconButton icon="chevronLeft" label="回訓練頁（訓練會保留）" onClick={() => navigate('/train')} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{workout.dayName}</p>
          <p className="num text-sm text-chalk-3">
            {elapsedText(now - workout.startedAt)} · {working.length}/{plannedTotal} 組
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setFinishOpen(true)}>
          完成
        </Button>
      </header>

      <RestTimer workout={workout} settings={settings} />

      <div className="flex flex-col gap-4 pt-4">
        {workout.plan.map((item, index) => {
          const firstIndex = workout.plan.findIndex((q) => q.exerciseId === item.exerciseId);
          if (firstIndex !== index) return null;
          return (
            <ExerciseCard
              key={`${item.exerciseId}-${index}`}
              workout={workout}
              item={item}
              index={index}
              ex={get(item.exerciseId)}
              sets={sets.filter((s) => s.exerciseId === item.exerciseId)}
              settings={settings}
              nextKey={nextKey}
              onLog={onLog}
              onMenu={() => setMenuIndex(index)}
            />
          );
        })}

        {workout.plan.length === 0 && (
          <div className="card p-6 text-center text-chalk-3">自由訓練：按下方按鈕加入第一個動作。</div>
        )}

        <Button icon="plus" size="lg" block onClick={() => setPicker({ mode: 'add' })}>
          新增動作
        </Button>
        <Button variant="ghost" block onClick={() => setDiscardOpen(true)}>
          放棄這場訓練
        </Button>
      </div>

      <ExercisePicker
        open={picker != null}
        onClose={() => setPicker(null)}
        title={picker?.mode === 'swap' ? '換成其他動作' : '新增動作'}
        onPick={(exId) => {
          if (picker?.mode === 'swap')
            void swapPlanExercise(workout.id, picker.index, exId).then((r) => {
              if (r === 'kept') toast('已完成的組保留在原動作，新動作排在它後面');
            });
          else void addExerciseToWorkout(workout.id, exId, settings.training.defaultRestSec);
        }}
      />

      {menuIndex != null && workout.plan[menuIndex] && (
        <ExerciseMenu
          workout={workout}
          index={menuIndex}
          item={workout.plan[menuIndex]!}
          ex={get(workout.plan[menuIndex]!.exerciseId)}
          onClose={() => setMenuIndex(null)}
          onSwap={() => {
            setPicker({ mode: 'swap', index: menuIndex });
            setMenuIndex(null);
          }}
        />
      )}

      <Sheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title="完成訓練？"
        footer={
          working.length > 0 ? (
            <Button variant="primary" size="lg" block disabled={busy} onClick={onFinish}>
              {busy ? '計算中…' : '完成並計算下次重量'}
            </Button>
          ) : (
            <Button variant="danger" size="lg" block onClick={() => setDiscardOpen(true)}>
              沒有任何正式組，放棄這場
            </Button>
          )
        }
      >
        <div className="grid grid-cols-3 gap-3">
          <Stat label="時間" value={elapsedText(now - workout.startedAt)} />
          <Stat label="正式組" value={`${working.length}`} sub={`計畫 ${plannedTotal}`} />
          <Stat label="訓練量" value={`${fmt(toDisplayWeight(tonnage(sets), settings.units.weight), 0)}`} sub={settings.units.weight} />
        </div>
        {working.length < plannedTotal && working.length > 0 && (
          <p className="mt-4 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">還有 {plannedTotal - working.length} 組沒做。有做但組數不足的動作算「未達標」、下次維持重量；完全沒做的動作不會調整。</p>
        )}
      </Sheet>

      <Sheet
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="放棄這場訓練？"
        footer={
          <div className="flex gap-2">
            <Button block onClick={() => setDiscardOpen(false)}>
              繼續練
            </Button>
            <Button
              variant="danger"
              block
              onClick={async () => {
                await discardWorkout(workout.id);
                navigate('/train', { replace: true });
              }}
            >
              放棄並刪除
            </Button>
          </div>
        }
      >
        <p className="text-chalk-2">這場訓練記錄的 {sets.length} 組都會刪除，下次重量不會更新。</p>
      </Sheet>

    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-well p-3">
      <span className="label">{label}</span>
      <span className="num text-h3 font-semibold">{value}</span>
      {sub && <span className="text-cap text-chalk-4">{sub}</span>}
    </div>
  );
}

function ExerciseCard({
  workout,
  item,
  index,
  ex,
  sets,
  settings,
  nextKey,
  onLog,
  onMenu,
}: {
  workout: Workout;
  item: PlanItem;
  index: number;
  ex: AnyExercise | undefined;
  sets: WorkoutSet[];
  settings: Settings;
  nextKey: string | null;
  onLog: (item: PlanItem, v: { weightKg: number; reps: number; rir: number | null }, kind?: WorkoutSet['kind']) => Promise<void>;
  onMenu: () => void;
}) {
  const unit = settings.units.weight;
  const [showWarmup, setShowWarmup] = useState(false);
  const [plateOpen, setPlateOpen] = useState(false);
  const last = useLiveQuery(() => lastSessionSets(item.exerciseId, workout.id), [item.exerciseId, workout.id]);
  const state = useLiveQuery(() => db.progressionState.get(item.exerciseId), [item.exerciseId]);
  const pref = useLiveQuery(() => db.exercisePrefs.get(item.exerciseId), [item.exerciseId]);

  const working = sets.filter((s) => s.kind === 'working');
  const warmups = sets.filter((s) => s.kind === 'warmup');
  const lastWorking = (last ?? []).filter((s) => s.kind === 'working');
  const rows = Math.max(item.sets, working.length);
  const isBarbell = ex ? BARBELL.has(ex.equipment) : false;
  const step = ex
    ? roundingStepFor(ex.equipment, {
        smallestPlateKg: smallestPlateKg(settings),
        dumbbellStepKg: settings.equipment.dumbbellStepKg,
        machineStepKg: settings.equipment.machineStepKg,
      })
    : 2.5;
  const target = item.targetWeightKg;
  const warm = target && ex?.category === 'compound' && ex.loadType === 'external' ? warmupSets(target, isBarbell ? settings.equipment.barKg : 0, step) : [];
  const repText = item.repMin === item.repMax ? `${item.repMax}` : `${item.repMin}–${item.repMax}`;
  const done = working.length >= item.sets;

  const defaultsFor = (i: number) => {
    const lastLogged = working.at(-1);
    return {
      weightKg: lastLogged?.weightKg ?? target ?? lastWorking[i]?.weightKg ?? lastWorking.at(-1)?.weightKg ?? null,
      reps: item.targetReps ?? lastWorking[i]?.reps ?? null,
    };
  };

  return (
    <section className={`card overflow-hidden ${done ? 'opacity-80' : ''}`} aria-label={ex?.nameZh}>
      <div className="flex items-start gap-2 p-4 pb-2">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-h4 font-semibold">
            <span className="truncate">{ex?.nameZh ?? '（已刪除的動作）'}</span>
            {done && <Icon name="check" size={18} className="shrink-0 text-go" />}
          </h2>
          <p className="num text-sm text-chalk-2">
            {item.sets} 組 × {repText} 下
            {target != null && <> · 目標 {fmt(toDisplayWeight(target, unit), 2)} {unit}</>}
            {item.supersetGroup != null && <span className="ml-1.5 rounded-sm bg-iron-3 px-1.5 text-cap">超級組</span>}
          </p>
          {lastWorking.length > 0 && (
            <p className="num truncate text-sm text-chalk-3">
              上次：{fmt(toDisplayWeight(lastWorking[0]!.weightKg, unit), 2)} {unit} × {lastWorking.map((s) => s.reps).join('、')}
            </p>
          )}
          {state?.lastMessage && !working.length && <p className="text-sm text-chalk-3">{state.lastMessage}</p>}
          {pref?.note && <p className="mt-1 text-sm text-warn">📝 {pref.note}</p>}
        </div>
        <IconButton icon="more" label={`${ex?.nameZh ?? ''} 選項`} onClick={onMenu} />
      </div>

      {isBarbell && target != null && target > settings.equipment.barKg && (
        <button type="button" onClick={() => setPlateOpen(true)} className="press mx-4 mb-2 flex items-center gap-2 rounded-md bg-well px-3 py-2 text-left">
          <PlateBar targetKg={target} barKg={settings.equipment.barKg} stock={settings.equipment.plates} compact />
          <span className="num min-w-0 flex-1 truncate text-sm text-chalk-3">
            每側 {plateText(target, settings)}
          </span>
          <Icon name="chevronRight" size={16} className="text-chalk-4" />
        </button>
      )}

      {warm.length > 0 && (
        <div className="px-4 pb-1">
          <button type="button" onClick={() => setShowWarmup((v) => !v)} className="press flex h-9 items-center gap-1 text-sm text-chalk-3 hover:text-chalk-2">
            <Icon name={showWarmup ? 'chevronDown' : 'chevronRight'} size={16} />
            暖身組建議（{warmups.length}/{warm.length}）
          </button>
          {showWarmup && (
            <div className="flex flex-col gap-1 pb-2">
              {warm.map((w, i) => {
                const logged = warmups[i];
                return (
                  <div key={i} className="flex items-center gap-3 rounded-md bg-well px-3 py-1.5">
                    <span className="w-6 text-cap text-chalk-4">暖</span>
                    <span className="num flex-1 text-base">
                      {fmt(toDisplayWeight(w.weightKg, unit), 2)} {unit} × {w.reps}
                    </span>
                    <button
                      type="button"
                      aria-label={logged ? '已完成暖身組' : '完成暖身組'}
                      disabled={!!logged}
                      onClick={() => void onLog(item, { weightKg: w.weightKg, reps: w.reps, rir: null }, 'warmup')}
                      className={`press flex h-9 w-9 items-center justify-center rounded-md ${logged ? 'bg-go-soft text-go' : 'border border-seam text-chalk-3'}`}
                    >
                      <Icon name="check" size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5 px-2 pb-3 sm:px-4">
        <div className={`grid items-center gap-2 px-2 text-cap text-chalk-4 ${settings.training.useRir ? 'grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)_64px_48px]' : 'grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)_48px]'}`}>
          <span>組</span>
          <span className="text-center">重量（{unit}）</span>
          <span className="text-center">次數</span>
          {settings.training.useRir && <span className="text-center">RIR</span>}
          <span />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <SetRow
            key={working[i]?.id ?? `draft-${i}`}
            n={i + 1}
            logged={working[i]}
            defaults={defaultsFor(i)}
            unit={unit}
            useRir={settings.training.useRir}
            isNext={nextKey === `${index}:${i}`}
            onLog={(v) => onLog(item, v)}
          />
        ))}
        <button
          type="button"
          disabled={item.sets >= LIMITS.planSets[1]}
          onClick={() => void updatePlanItem(workout.id, index, { sets: item.sets + 1 })}
          className="press mx-2 flex h-10 disabled:opacity-40 items-center justify-center gap-1 rounded-md text-sm font-medium text-chalk-3 hover:bg-iron-2 hover:text-chalk-2"
        >
          <Icon name="plus" size={16} />
          加一組
        </button>
      </div>

      <Sheet open={plateOpen} onClose={() => setPlateOpen(false)} title="槓片配重">
        {target != null && <PlateCalculator initialKg={target} settings={settings} />}
      </Sheet>
    </section>
  );
}

function plateText(targetKg: number, s: Settings) {
  const side = (targetKg - s.equipment.barKg) / 2;
  return side > 0 ? `${fmt(side, 2)} kg` : '—';
}

function SetRow({
  n,
  logged,
  defaults,
  unit,
  useRir,
  isNext,
  onLog,
}: {
  n: number;
  logged: WorkoutSet | undefined;
  defaults: { weightKg: number | null; reps: number | null };
  unit: 'kg' | 'lb';
  useRir: boolean;
  isNext: boolean;
  onLog: (v: { weightKg: number; reps: number; rir: number | null }) => Promise<void>;
}) {
  const [weight, setWeight] = useState<number | null>(logged?.weightKg ?? defaults.weightKg);
  const [reps, setReps] = useState<number | null>(logged?.reps ?? defaults.reps);
  const [rir, setRir] = useState<number | null>(logged?.rir ?? null);
  const [touched, setTouched] = useState(false);

  // 尚未記錄且沒被手動改過時，跟著預設值（例如前一組改了重量）
  useEffect(() => {
    if (logged || touched) return;
    setWeight(defaults.weightKg);
    setReps(defaults.reps);
  }, [defaults.weightKg, defaults.reps, logged, touched]);

  const canLog = weight != null && weight >= 0 && reps != null && reps >= 1;

  async function toggle() {
    if (logged) {
      const removed = await deleteSet(logged.id);
      if (removed) toastUndo(`已取消第 ${n} 組`, () => restoreSet(removed));
      return;
    }
    if (!canLog) return;
    await onLog({ weightKg: weight!, reps: Math.round(reps!), rir });
  }

  const commit = (patch: Partial<Pick<WorkoutSet, 'weightKg' | 'reps' | 'rir'>>) => {
    if (logged) void updateSet(logged.id, patch);
  };

  return (
    <div
      className={`grid items-center gap-2 rounded-md px-2 py-1 ${useRir ? 'grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)_64px_48px]' : 'grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)_48px]'} ${
        logged ? 'bg-go-soft/60' : isNext ? 'bg-iron-2 ring-1 ring-seam-strong' : ''
      }`}
    >
      <span className={`num text-center text-base font-semibold ${logged ? 'text-go' : 'text-chalk-3'}`}>{n}</span>
      <NumberInput
        ariaLabel={`第 ${n} 組重量`}
        value={weight == null ? null : Number(toDisplayWeight(weight, unit).toFixed(2))}
        placeholder="填重量"
        decimals={2}
        min={0}
        max={unit === 'kg' ? 1000 : 2200}
        onChange={(v) => {
          setTouched(true);
          const kg = v == null ? null : fromDisplayWeight(v, unit);
          setWeight(kg);
          if (kg != null) commit({ weightKg: kg });
        }}
      />
      <NumberInput
        ariaLabel={`第 ${n} 組次數`}
        value={reps}
        decimals={0}
        min={0}
        max={1000}
        onChange={(v) => {
          setTouched(true);
          setReps(v);
          if (v != null) commit({ reps: Math.round(v) });
        }}
      />
      {useRir && (
        <NumberInput
          ariaLabel={`第 ${n} 組 RIR`}
          value={rir}
          decimals={0}
          min={0}
          max={10}
          placeholder="—"
          onChange={(v) => {
            setRir(v);
            commit({ rir: v });
          }}
        />
      )}
      <button
        type="button"
        aria-label={logged ? `取消第 ${n} 組` : `完成第 ${n} 組`}
        aria-pressed={!!logged}
        disabled={!logged && !canLog}
        onClick={() => void toggle()}
        className={`press flex h-11 w-12 items-center justify-center rounded-md disabled:opacity-30 ${
          logged ? 'bg-go text-on-chalk' : isNext ? 'bg-chalk text-on-chalk' : 'border border-seam bg-iron-2 text-chalk-3'
        }`}
      >
        <Icon name="check" size={22} strokeWidth={2.4} />
      </button>
    </div>
  );
}

function ExerciseMenu({
  workout,
  index,
  item,
  ex,
  onClose,
  onSwap,
}: {
  workout: Workout;
  index: number;
  item: PlanItem;
  ex: AnyExercise | undefined;
  onClose: () => void;
  onSwap: () => void;
}) {
  const pref = useLiveQuery(() => db.exercisePrefs.get(item.exerciseId), [item.exerciseId]);
  const loggedCount = useLiveQuery(() => db.sets.where({ workoutId: workout.id }).filter((s) => s.exerciseId === item.exerciseId).count(), [workout.id, item.exerciseId]) ?? 0;
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const saveNote = async () => {
    if (note == null) return;
    await db.exercisePrefs.put({ ...(pref ?? { exerciseId: item.exerciseId }), note: note.trim() || undefined, updatedAt: Date.now() });
  };
  return (
    <Sheet open onClose={onClose} title={ex?.nameZh ?? '動作'}>
      <div className="flex flex-col gap-4">
        {ex && (
          <div className="rounded-md bg-well p-3 text-sm text-chalk-2">
            <p className="mb-1 text-chalk-3">
              {EQUIPMENT_LABEL[ex.equipment]} · 主要：{ex.primary.map((m) => MUSCLE_LABEL[m]).join('、')}
              {ex.secondary.length > 0 && ` · 輔助：${ex.secondary.map((m) => MUSCLE_LABEL[m]).join('、')}`}
            </p>
            <p>{ex.cues}</p>
          </div>
        )}
        <Field label="動作備註（例如座椅高度、握距）">
          <textarea
            className="field min-h-20 py-2"
            maxLength={500}
            value={note ?? pref?.note ?? ''}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => void saveNote()}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="這場的組數">
            <NumberInput ariaLabel="組數" value={item.sets} decimals={0} min={0} max={20} stepper onChange={(v) => v != null && void updatePlanItem(workout.id, index, { sets: Math.round(v) })} />
          </Field>
          <Field label="休息（秒）">
            <NumberInput ariaLabel="休息秒數" value={item.restSec} step={15} decimals={0} min={0} max={900} stepper onChange={(v) => v != null && void updatePlanItem(workout.id, index, { restSec: Math.round(v) })} />
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <Button icon="swap" block onClick={onSwap}>
            換成其他動作
          </Button>
          {loggedCount > 0 && <p className="text-cap text-chalk-4">已記錄的組會保留在原動作，新動作排在後面。</p>}
          {confirmRemove && loggedCount > 0 && (
            <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">已經記錄了 {loggedCount} 組，移除會一起刪掉（之後可以按「復原」）。</p>
          )}
          <Button
            variant="danger"
            icon="trash"
            block
            onClick={async () => {
              if (loggedCount > 0 && !confirmRemove) {
                setConfirmRemove(true);
                return;
              }
              const removed = await removePlanItem(workout.id, index);
              onClose();
              if (removed) toastUndo(`已移除${ex?.nameZh ?? '動作'}`, () => restorePlanItem(workout.id, removed));
            }}
          >
            {confirmRemove && loggedCount > 0 ? `確定移除並刪除 ${loggedCount} 組` : '從這場移除'}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
