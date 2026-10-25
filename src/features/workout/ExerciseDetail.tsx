import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '../../content/types';
import { shortDateLabel } from '../../core/dates';
import { computePrs, type DatedSet } from '../../core/training/strength';
import { fmt, toDisplayWeight } from '../../core/units';
import { db } from '../../db/db';
import { useLatestWeight } from '../../db/repo/body';
import { saveExercisePref, useExerciseLookup, type PrefPatch } from '../../db/repo/exercises';
import { useSettings } from '../../db/repo/settings';
import { exerciseHistory } from '../../db/repo/workouts';
import { Button } from '../../ui/Button';
import { Field, NumberInput } from '../../ui/Fields';
import { EmptyState, goBackOr, PageHeader, Section } from '../../ui/Layout';
import { toast, toastUndo } from '../../ui/toast';
import { ExerciseForm } from './ExerciseLibrary';
import { exerciseSeries } from './trainingStats';

const E1rmChart = lazy(() => import('./E1rmChart'));

export default function ExerciseDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const settings = useSettings();
  const bw = useLatestWeight();
  const { get, ready } = useExerciseLookup();
  const ex = get(id);
  const sets = useLiveQuery(() => exerciseHistory(id), [id]);
  const series = useLiveQuery(() => (settings ? exerciseSeries(id, settings) : undefined), [id, settings?.training.e1rmFormula, settings?.training.useRir]);
  const pref = useLiveQuery(() => db.exercisePrefs.get(id), [id]);
  const state = useLiveQuery(() => db.progressionState.get(id), [id]);
  const custom = useLiveQuery(() => db.exercisesCustom.get(id), [id]);
  const [editing, setEditing] = useState(false);

  if (!settings || !ready || sets === undefined) return null;
  if (!ex) return <EmptyState icon="dumbbell" title="找不到這個動作" />;
  const unit = settings.units.weight;
  const dw = (kg: number) => `${fmt(toDisplayWeight(kg, unit), 2)} ${unit}`;
  const prs = computePrs(sets as DatedSet[], {
    formula: settings.training.e1rmFormula,
    useRir: settings.training.useRir,
    loadType: ex.loadType,
    bodyweightKg: bw ?? null,
  });

  const savePref = (patch: PrefPatch) =>
    saveExercisePref(id, patch).catch((e: unknown) => toast(e instanceof Error ? e.message : String(e), { tone: 'error' }));

  // 依場次分組的紀錄（新到舊）
  const byWorkout = new Map<string, typeof sets>();
  for (const s of [...sets].sort((a, b) => b.date.localeCompare(a.date) || a.order - b.order)) {
    byWorkout.set(s.workoutId, [...(byWorkout.get(s.workoutId) ?? []), s]);
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <PageHeader
        title={ex.nameZh}
        back="/train/exercises"
        sub={`${EQUIPMENT_LABEL[ex.equipment]} · ${ex.nameEn || '自建動作'}`}
        actions={custom && <Button size="sm" onClick={() => setEditing(true)}>編輯</Button>}
      />

      <div className="card flex flex-col gap-2 p-4">
        <p className="text-sm text-chalk-3">
          主要：<span className="text-chalk">{ex.primary.map((m) => MUSCLE_LABEL[m]).join('、')}</span>
          {ex.secondary.length > 0 && (
            <>
              {' '}· 輔助：<span className="text-chalk-2">{ex.secondary.map((m) => MUSCLE_LABEL[m]).join('、')}</span>
            </>
          )}
        </p>
        {ex.cues && <p className="text-base text-chalk-2">{ex.cues}</p>}
        {ex.aliases.length > 0 && <p className="text-sm text-chalk-3">又稱：{ex.aliases.join('、')}</p>}
      </div>

      {prs.bestE1rm || prs.bestSessionVolume ? (
        <div className="grid grid-cols-2 gap-2">
          {prs.bestE1rm && (
            <div className="card flex flex-col p-4">
              <span className="label">估計 1RM 最佳</span>
              <span className="num text-h1 font-semibold">{fmt(toDisplayWeight(prs.bestE1rm.value, unit))}</span>
              <span className="num text-sm text-chalk-3">
                {dw(prs.bestE1rm.weightKg)} × {prs.bestE1rm.reps} · {shortDateLabel(prs.bestE1rm.date)}
              </span>
            </div>
          )}
          {state?.workingWeightKg != null && (
            <div className="card flex flex-col p-4">
              <span className="label">下次工作重量</span>
              <span className="num text-h1 font-semibold">{fmt(toDisplayWeight(state.workingWeightKg, unit), 2)}</span>
              <span className="text-sm text-chalk-3">{state.consecutiveFails > 0 ? `已連續 ${state.consecutiveFails} 次未達標` : unit}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="px-1 text-sm text-chalk-3">還沒有這個動作的紀錄。</p>
      )}

      {series && series.length >= 2 && (
        <Section title="估計 1RM 趨勢">
          <div className="card p-3">
            <Suspense fallback={<div className="h-52" />}>
              <E1rmChart
                unit={unit}
                data={series.map((p) => ({
                  date: p.date,
                  value: toDisplayWeight(p.best, unit),
                  detail: `最重 ${dw(p.topWeightKg)} × ${p.topReps}`,
                }))}
              />
            </Suspense>
          </div>
        </Section>
      )}

      {prs.repMaxes.size > 0 && (
        <Section title="各次數最大重量">
          <div className="card grid grid-cols-3 gap-px overflow-hidden bg-seam sm:grid-cols-4">
            {[...prs.repMaxes]
              .sort((a, b) => a[0] - b[0])
              .map(([reps, r]) => (
                <div key={reps} className="flex flex-col bg-iron p-3">
                  <span className="label">{reps} 下</span>
                  <span className="num font-semibold">{dw(r.weightKg)}</span>
                  <span className="num text-cap text-chalk-3">{r.date.slice(5)}</span>
                </div>
              ))}
          </div>
        </Section>
      )}

      <Section title="我的設定">
        <div className="card flex flex-col gap-3 p-4">
          <Field label="備註（座椅高度、握距…）">
            <textarea className="field min-h-16 py-2" maxLength={500} defaultValue={pref?.note ?? ''} key={pref?.updatedAt ?? 0} onBlur={(e) => void savePref({ note: e.target.value.trim() || undefined })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="休息秒數" hint="覆寫課表設定">
              <NumberInput ariaLabel="休息秒數" value={pref?.restSec ?? null} decimals={0} min={0} max={900} placeholder="依課表" onChange={() => undefined} onCommit={(v) => void savePref({ restSec: v ?? undefined })} />
            </Field>
            <Field label="每次加重（kg）" hint={`預設 ${ex.defaultIncrementKg}`}>
              <NumberInput ariaLabel="每次加重" value={pref?.incrementKg ?? null} decimals={2} min={0} max={20} placeholder="預設" onChange={() => undefined} onCommit={(v) => void savePref({ incrementKg: v ?? undefined })} />
            </Field>
          </div>
          <RepRangePref repMin={pref?.repMin} repMax={pref?.repMax} fallback={ex.defaultRepRange} onSave={(repMin, repMax) => void savePref({ repMin, repMax })} />
        </div>
      </Section>

      <Section title={`紀錄 · ${byWorkout.size} 場`}>
        {byWorkout.size === 0 ? (
          <p className="px-1 text-sm text-chalk-3">完成訓練後會出現在這裡。</p>
        ) : (
          <div className="card divide-y divide-seam overflow-hidden">
            {[...byWorkout].slice(0, 30).map(([wid, list]) => (
              <button key={wid} type="button" onClick={() => navigate(`/train/history/${wid}`)} className="press flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-iron-2">
                <span className="num w-24 shrink-0 text-sm text-chalk-3">{shortDateLabel(list[0]!.date)}</span>
                <span className="num min-w-0 flex-1 truncate text-sm">
                  {list
                    .filter((s) => s.kind === 'working')
                    .map((s) => `${fmt(toDisplayWeight(s.weightKg, unit), 2)}×${s.reps}`)
                    .join('  ')}
                </span>
              </button>
            ))}
          </div>
        )}
      </Section>

      {custom && (
        <Button
          variant="danger"
          block
          onClick={async () => {
            await db.exercisesCustom.delete(id);
            goBackOr(navigate, '/train/exercises');
            toastUndo(`已刪除「${custom.nameZh}」`, () => db.exercisesCustom.put(custom));
          }}
        >
          刪除這個自建動作
        </Button>
      )}
      {editing && custom && <ExerciseForm initial={custom} onClose={() => setEditing(false)} />}
    </div>
  );
}

/** 我的次數區間：兩格都填才生效，覆寫課表的次數；清空就回到課表設定 */
function RepRangePref({
  repMin,
  repMax,
  fallback,
  onSave,
}: {
  repMin: number | undefined;
  repMax: number | undefined;
  fallback: [number, number];
  onSave: (repMin: number | undefined, repMax: number | undefined) => void;
}) {
  const [lo, setLo] = useState<number | null>(repMin ?? null);
  const [hi, setHi] = useState<number | null>(repMax ?? null);
  // 存檔後（或在別處清除）同步回來；不用 key 重建元件，避免輸入中失去焦點
  useEffect(() => {
    setLo(repMin ?? null);
    setHi(repMax ?? null);
  }, [repMin, repMax]);
  const bad = (v: number | null) => v != null && !(Number.isInteger(v) && v >= 1 && v <= 100);
  const error =
    bad(lo) || bad(hi)
      ? '次數請輸入 1–100 的整數'
      : lo != null && hi != null && lo > hi
        ? '下限不能大於上限'
        : (lo == null) !== (hi == null)
          ? '兩格都填才會生效'
          : null;
  const commit = (a: number | null, b: number | null) => {
    if (bad(a) || bad(b)) return;
    if (a == null && b == null) return onSave(undefined, undefined);
    if (a != null && b != null && a <= b) onSave(a, b);
  };
  return (
    <Field label="我的次數區間" hint={error ? undefined : repMin != null ? `已覆寫課表：${repMin}–${repMax} 下` : `空白＝依課表（動作預設 ${fallback[0]}–${fallback[1]} 下）`} error={error}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <NumberInput ariaLabel="次數下限" value={lo} decimals={0} min={1} max={100} clamp={false} placeholder="下限" onChange={setLo} onCommit={(v) => commit(v, hi)} />
        <span className="text-chalk-3">–</span>
        <NumberInput ariaLabel="次數上限" value={hi} decimals={0} min={1} max={100} clamp={false} placeholder="上限" onChange={setHi} onCommit={(v) => commit(lo, v)} />
      </div>
    </Field>
  );
}
