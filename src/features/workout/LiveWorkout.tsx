import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '../../content/types';
import { lbStepFor, roundingStepFor } from '../../core/training/progression';
import { warmupSets } from '../../core/training/strength';
import { belongsToItem, setAtPosition, WEIGHT_LABEL, SKIP_REASONS } from '../../core/training/logging';
import { SetRecorder as SetRow, type RecorderValues } from './SetRecorder';
import { MachineEditor, contextText } from './MachineEditor';
import { createMachineVariant } from '../../db/repo/exercises';
import { WorkoutShare } from './WorkoutShare';
import { tonnage } from '../../core/training/volume';
import { fmt, roundTo, toDisplayWeight } from '../../core/units';
import { db } from '../../db/db';
import { smallestPlateKg } from '../../db/defaults';
import { LIMITS } from '../../db/limits';
import { useExerciseLookup, type AnyExercise } from '../../db/repo/exercises';
import { useSettings } from '../../db/repo/settings';
import {
  addExerciseToWorkout,
  discardWorkout,
  finishWorkout,
  lastSessionSets,
  logSet,
  removePlanItem,
  restorePlanItem,
  swapPlanExercise,
  updatePlanItem,
  updateWorkoutDetails,
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
import { BARBELL_EQUIPMENT, plateSetup } from './plates';
import { RestTimer } from './RestTimer';

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
      <WorkoutShare workoutId={workoutId} />
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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
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
      if (p.skipReason || p.replacedBy) continue;
      const working = sets.filter((s) => belongsToItem(s, p, i, workout.plan) && s.kind === 'working');
      for (let n = 0; n < p.sets; n++) if (!setAtPosition(working, n)) return String(i) + ':' + n;
    }
    return null;
  }, [workout.plan, sets]);

  const working = sets.filter((s) => s.kind === 'working');
  const plannedTotal = workout.plan.reduce((a, p) => a + p.sets, 0);

  async function onLog(item: PlanItem, values: RecorderValues, kind: WorkoutSet['kind'] = 'working') {
    unlockAudio();
    await logSet(workout.id, { exerciseId: item.exerciseId, kind, ...values, planItemId: item.id }, kind === 'warmup' ? Math.min(60, item.restSec) : item.restSec);
    if (kind === 'working' && sets.filter((s) => s.planItemId === item.id && s.kind === 'working').length + 1 >= item.sets) setSelectedIndex((current) => current === workout.plan.findIndex((p) => p.id === item.id) ? null : current);
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
          <p className="truncate font-semibold">{(selectedIndex != null && selectedIndex >= 0 ? workout.plan[selectedIndex]?.nameSnapshot : nextKey ? workout.plan[Number(nextKey.split(':')[0])]?.nameSnapshot : undefined) ?? workout.dayName}</p>
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
        {workout.deload && (
          <p className="rounded-md border border-seam-strong bg-go-soft px-3 py-2 text-sm text-chalk" role="note">
            減量週：這場的組數與重量已經調低，動作照常練、不要做到力竭。完成後不會改變進步紀錄。
          </p>
        )}
        {workout.plan.map((item, index) => {
          return (
            <ExerciseCard
              key={`${item.exerciseId}-${index}`}
              workout={workout}
              item={item}
              index={index}
              ex={get(item.exerciseId)}
              sets={sets.filter((s) => belongsToItem(s, item, index, workout.plan))}
              settings={settings}
              expanded={selectedIndex === index || (selectedIndex == null && nextKey?.startsWith(String(index) + ':') === true)}
              onSelect={() => setSelectedIndex((current) => (current === index || current == null && nextKey?.startsWith(String(index) + ':')) ? -1 : index)}
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
              {busy ? '計算中…' : workout.deload ? '完成（減量週不調整重量）' : '完成並計算下次重量'}
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
        <div className="mt-4 flex flex-col gap-3">
          <Field label="整體感受（選填）"><div className="flex gap-2">{(['輕鬆', '適中', '吃力'] as const).map((v) => <button type="button" key={v} aria-pressed={workout.feeling === v} className={'press min-h-11 flex-1 rounded-md border px-2 ' + (workout.feeling === v ? 'border-chalk text-chalk' : 'border-seam text-chalk-3')} onClick={() => void updateWorkoutDetails(workout.id, { feeling: workout.feeling === v ? undefined : v })}>{v}</button>)}</div></Field>
          <Field label="給教練的備註（選填）"><textarea aria-label="給教練的備註" className="field min-h-20 py-2" maxLength={2000} defaultValue={workout.notes} onBlur={(e) => void updateWorkoutDetails(workout.id, { notes: e.target.value })} /></Field>
        </div>
        {working.length < plannedTotal && working.length > 0 && (
          <p className="mt-4 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">還有 {plannedTotal - working.length} 組沒做。未完成的動作維持重量；已選跳過、替代或需注意的動作不累計失敗。完全沒做的動作不會調整。</p>
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
      {sub && <span className="text-cap text-chalk-3">{sub}</span>}
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
  expanded,
  onSelect,
  onLog,
  onMenu,
}: {
  workout: Workout;
  item: PlanItem;
  index: number;
  ex: AnyExercise | undefined;
  sets: WorkoutSet[];
  settings: Settings;
  expanded: boolean;
  onSelect: () => void;
  onLog: (item: PlanItem, v: RecorderValues, kind?: WorkoutSet['kind']) => Promise<void>;
  onMenu: () => void;
}) {
  const unit = item.context?.unit ?? settings.units.weight;
  const [machineOpen, setMachineOpen] = useState(false);
  const [showWarmup, setShowWarmup] = useState(false);
  const [plateOpen, setPlateOpen] = useState(false);
  const [dropDraft, setDropDraft] = useState(() => !!workout.drafts?.some((d) => d.planItemId === item.id && d.kind === 'drop'));
  const last = useLiveQuery(() => lastSessionSets(item.exerciseId, workout.id), [item.exerciseId, workout.id]);
  const state = useLiveQuery(() => db.progressionState.get(item.exerciseId), [item.exerciseId]);

  const working = sets.filter((s) => s.kind === 'working');
  const warmups = sets.filter((s) => s.kind === 'warmup');
  const drops = sets.filter((s) => s.kind === 'drop');
  const lastWorking = (last ?? []).filter((s) => s.kind === 'working');
  const rows = Math.max(item.sets, working.length, ...working.map((v) => (v.position ?? 0) + 1));
  const isBarbell = ex ? BARBELL_EQUIPMENT.has(ex.equipment) : false;
  // 槓片與暖身都以使用者單位計算（磅制用 lb 槓片、EZ 槓用自己的槓重），記錄時再換回公斤
  const setup = plateSetup({ ...settings, units: { weight: unit } }, ex?.equipment ?? 'barbell');
  const step = item.context?.step ?? (ex
    ? unit === 'lb'
      ? lbStepFor(ex.equipment, setup.step / 2)
      : roundingStepFor(ex.equipment, {
          smallestPlateKg: smallestPlateKg(settings),
          dumbbellStepKg: settings.equipment.dumbbellStepKg,
          machineStepKg: settings.equipment.machineStepKg,
        })
    : 2.5);
  const target = item.targetWeightKg;
  const targetU = target == null ? null : setup.toUnit(target);
  const warm =
    targetU && ex?.category === 'compound' && ex.loadType === 'external'
      ? warmupSets(targetU, isBarbell ? setup.bar : 0, step, settings.training.warmup).map((w) => ({ weightKg: setup.fromUnit(w.weightKg), reps: w.reps }))
      : [];
  const lastLoggedWorking = working.at(-1);
  // 遞減組預設：上一個正式組的 80%，對齊級距
  const dropDefaults = lastLoggedWorking
    ? {
        weightKg: setup.fromUnit(Math.max(0, roundTo(setup.toUnit((drops.at(-1) ?? lastLoggedWorking).weightKg) * 0.8, step))),
        reps: (drops.at(-1) ?? lastLoggedWorking).reps,
      }
    : { weightKg: null, reps: null };
  const repText = item.repMin === item.repMax ? `${item.repMax}` : `${item.repMin}–${item.repMax}`;
  const done = working.length >= item.sets;
  const nextPosition = Array.from({ length: rows }, (_, i) => i).find((i) => !setAtPosition(working, i)) ?? -1;

  const defaultsFor = (i: number) => {
    const lastLogged = working.at(-1);
    return {
      weightKg: lastLogged?.weightKg ?? target ?? lastWorking[i]?.weightKg ?? lastWorking.at(-1)?.weightKg ?? null,
      reps: item.targetReps ?? lastWorking[i]?.reps ?? null,
    };
  };

  return (
    <section className={`card overflow-hidden ${done ? 'opacity-80' : ''}`} aria-label={item.nameSnapshot ?? ex?.nameZh}>
      <div className="flex items-start gap-2 p-4 pb-2">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-h4 font-semibold"><button type="button" aria-expanded={expanded} onClick={onSelect} className="press min-h-11 min-w-0 text-left" aria-label={(expanded ? '收合' : '展開') + (item.nameSnapshot ?? ex?.nameZh ?? '動作')}>
            <span className="truncate">{item.nameSnapshot ?? ex?.nameZh ?? '（已刪除的動作）'}</span>
            </button>{done && <Icon name="check" size={18} className="shrink-0 text-go" />}
          </h2>
          <p className="num text-sm text-chalk-2">
            {item.sets} 組 × {repText} 下
            {target != null && <> · 目標 {fmt(toDisplayWeight(target, unit), 2)} {unit}</>}
            {item.supersetGroup != null && <span className="ml-1.5 rounded-sm bg-iron-3 px-1.5 text-cap">超級組</span>}
          </p>
          {lastWorking.length > 0 && (
            <p className="num break-words text-sm text-chalk-3">
              上次：{lastWorking.map((s) => fmt(toDisplayWeight(s.weightKg, unit), 2) + ' ' + unit + '×' + s.reps).join('／')}
            </p>
          )}
          {state?.lastMessage && !working.length && <p className="text-sm text-chalk-3">{state.lastMessage}</p>}
          <p className="mt-1 text-sm text-chalk-3">{WEIGHT_LABEL[item.context?.weightMeaning ?? 'unknown']} · 已做 {working.length}/{item.sets} 組</p>
          {contextText(item.context) && <p className="mt-1 break-words text-sm text-warn">{contextText(item.context)}</p>}
          {(item.skipReason || item.replacedBy) && <p className="text-sm text-warn">{item.skipReason ? '已跳過剩餘組：' + item.skipReason : '剩餘組改用替代動作'}</p>}
        </div>
        <IconButton icon="more" label={`${ex?.nameZh ?? ''} 選項`} onClick={onMenu} />
      </div>

      <div style={{ display: expanded ? undefined : 'none' }}>
      <button type="button" className="press mx-4 mb-3 min-h-11 text-sm text-chalk-2" onClick={() => setMachineOpen(true)}>器械設定與教練提醒</button>
      {isBarbell && targetU != null && targetU - setup.bar >= setup.step - 1e-6 && (
        <button type="button" onClick={() => setPlateOpen(true)} className="press mx-4 mb-2 flex items-center gap-2 rounded-md bg-well px-3 py-2 text-left" aria-label="槓片配重">
          <PlateBar target={targetU} bar={setup.bar} stock={setup.stock} unit={setup.unit} compact />
          <span className="num min-w-0 flex-1 truncate text-sm text-chalk-3">
            每側 {fmt((targetU - setup.bar) / 2, 2)} {setup.unit}
          </span>
          <Icon name="chevronRight" size={16} className="text-chalk-3" />
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
                    <span className="w-6 text-cap text-chalk-3">暖</span>
                    <span className="num flex-1 text-base">
                      {fmt(toDisplayWeight(w.weightKg, unit), 2)} {unit} × {w.reps}
                    </span>
                    <button
                      type="button"
                      aria-label={logged ? '已完成暖身組' : '完成暖身組'}
                      disabled={!!logged}
                      onClick={() => void onLog(item, { weightKg: w.weightKg, reps: w.reps, rir: null, setId: item.id + '-warm-' + i, position: i }, 'warmup')}
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
        {Array.from({ length: rows }, (_, i) => ((item.skipReason || item.replacedBy) && !setAtPosition(working, i) ? null : (
          <SetRow
            key={setAtPosition(working, i)?.id ?? 'draft-' + i}
            n={i + 1}
            logged={setAtPosition(working, i)}
            workout={workout} item={item} position={i} step={step}
            defaults={defaultsFor(i)}
            unit={unit}
            useRir={settings.training.useRir}
            isNext={expanded && nextPosition === i}
            onLog={(v) => onLog(item, v)}
          />
        )))}
        {(drops.length > 0 || dropDraft) && <p className="px-2 pt-1 text-cap text-chalk-3">遞減組（不列入進步規則與 PR）</p>}
        {drops.map((d, i) => (
          <SetRow
            key={d.id}
            n={i + 1}
            label="遞減"
            name={`遞減組 ${i + 1}`}
            logged={d}
            workout={workout} item={item} position={i} kind="drop" step={step}
            defaults={{ weightKg: d.weightKg, reps: d.reps }}
            unit={unit}
            useRir={settings.training.useRir}
            isNext={false}
            onLog={(v) => onLog(item, v, 'drop')}
          />
        ))}
        {dropDraft && lastLoggedWorking && (
          <SetRow
            key={`drop-draft-${drops.length}`}
            n={drops.length + 1}
            label="遞減"
            name={`遞減組 ${drops.length + 1}`}
            logged={undefined}
            workout={workout} item={item} position={drops.length} kind="drop" step={step}
            defaults={dropDefaults}
            unit={unit}
            useRir={settings.training.useRir}
            isNext={false}
            onLog={async (v) => {
              await onLog(item, v, 'drop');
              setDropDraft(false);
            }}
          />
        )}
        <div className="mx-2 grid grid-cols-2 gap-1">
          <button
            type="button"
            disabled={item.sets >= LIMITS.planSets[1]}
            onClick={() => void updatePlanItem(workout.id, index, { sets: item.sets + 1 })}
            className="press flex h-11 items-center justify-center gap-1 rounded-md text-sm font-medium text-chalk-3 hover:bg-iron-2 hover:text-chalk-2 disabled:opacity-40"
          >
            <Icon name="plus" size={16} />
            加一組
          </button>
          <button
            type="button"
            disabled={!lastLoggedWorking || dropDraft}
            onClick={() => setDropDraft(true)}
            title={lastLoggedWorking ? '做完正式組後立刻減重再做到力竭；不列入進步規則與 PR' : '先完成一組正式組'}
            className="press flex h-11 items-center justify-center gap-1 rounded-md text-sm font-medium text-chalk-3 hover:bg-iron-2 hover:text-chalk-2 disabled:opacity-40"
          >
            <Icon name="plus" size={16} />
            遞減組
          </button>
        </div>
        {dropDraft && <p className="px-2 text-cap text-chalk-3">做完一組正式組後立刻減重，再做到接近力竭。</p>}
      </div>

      <Sheet open={plateOpen} onClose={() => setPlateOpen(false)} title="槓片配重">
        {target != null && <PlateCalculator initialKg={target} settings={settings} equipment={ex?.equipment === 'ezbar' ? 'ezbar' : 'barbell'} />}
      </Sheet>
      </div>
      {machineOpen && <MachineEditor workout={workout} item={item} index={index} onClose={() => setMachineOpen(false)} />}
    </section>
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
  const loggedCount = useLiveQuery(() => db.sets.where({ workoutId: workout.id }).filter((s) => belongsToItem(s, item, index, workout.plan)).count(), [workout.id, item.exerciseId]) ?? 0;
  const [variant, setVariant] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const saveNote = async () => {
    if (note == null) return;
    await updatePlanItem(workout.id, index, { context: { ...item.context, reminder: note.trim() } });
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
            value={note ?? item.context?.reminder ?? ''}
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
        <Field label="跳過剩餘組">
          <div className="flex flex-wrap gap-2">{SKIP_REASONS.map((reason) => <Button key={reason} onClick={async () => { await updatePlanItem(workout.id, index, { skipReason: reason }); onClose(); }}>{reason}</Button>)}</div>
          {item.skipReason && <Button onClick={async () => { await updatePlanItem(workout.id, index, { skipReason: undefined }); onClose(); }}>恢復此動作</Button>}
        </Field>
        <Field label="不同機台，另建器械版本">
          <input className="field" aria-label="器械版本名稱" maxLength={30} placeholder="例如：靠窗的 A 機" value={variant} onChange={(e) => setVariant(e.target.value)} />
          <Button disabled={!variant.trim()} onClick={async () => { try { const id = await createMachineVariant(item.exerciseId, variant); await swapPlanExercise(workout.id, index, id); onClose(); } catch { toast('新增器械版本失敗，請重試', { tone: 'error' }); } }}>建立版本並換用</Button>
          <p className="text-sm text-chalk-3">不同版本分開保留重量、歷史與進步狀態。</p>
        </Field>
        <div className="flex flex-col gap-2">
          <Button icon="swap" block onClick={onSwap}>
            換成其他動作
          </Button>
          {loggedCount > 0 && <p className="text-cap text-chalk-3">已記錄的組會保留在原動作，新動作排在後面。</p>}
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
