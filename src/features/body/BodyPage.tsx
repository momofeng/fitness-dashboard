import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { dailyAverages, ffmi, movingAverage, rateVerdict, trendSeries, weeklyRatePct } from '../../core/body';
import { addDays, relativeDayLabel, shortDateLabel } from '../../core/dates';
import { fmt, fromDisplayWeight, toDisplayWeight } from '../../core/units';
import { db } from '../../db/db';
import { LIMITS } from '../../db/limits';
import { moveBodyMetric, upsertBodyMetric, useBodyMetrics, validateBodyPatch } from '../../db/repo/body';
import { CIRC_LABEL, CIRCUMFERENCES, type BodyMetric, type Circumference } from '../../db/schemas';
import { Button, IconButton } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Field, NumberInput, Segmented, TextField } from '../../ui/Fields';
import { EmptyState, PageHeader, Section } from '../../ui/Layout';
import { Sheet } from '../../ui/Sheet';
import { toast, toastUndo } from '../../ui/toast';
import { useTargets } from '../shared/useToday';

const WeightChart = lazy(() => import('./WeightChart'));

export default function BodyPage() {
  const { settings, today } = useTargets();
  const metrics = useBodyMetrics();
  const [range, setRange] = useState<30 | 90 | 365>(30);
  const [edit, setEdit] = useState<{ date: string } | null>(null);

  const daily = useMemo(
    () => dailyAverages((metrics ?? []).filter((m) => m.weightKg != null).map((m) => ({ date: m.date, value: m.weightKg! }))),
    [metrics],
  );
  if (!settings || !metrics) return null;
  const unit = settings.units.weight;
  const dw = (kg: number, d = 1) => fmt(toDisplayWeight(kg, unit), d);

  const todayRow = metrics.find((m) => m.date === today);
  const avg7 = movingAverage(daily, today);
  const rate = weeklyRatePct(daily, today);
  const verdict = rate != null ? rateVerdict(rate, settings.nutrition.weeklyGainPct) : null;
  const latestWeight = [...metrics].reverse().find((m) => m.weightKg != null);
  const latestFat = [...metrics].reverse().find((m) => m.bodyFatPct != null);
  const f = latestWeight && latestFat ? ffmi(latestWeight.weightKg!, latestFat.bodyFatPct!, settings.profile.heightCm) : null;
  const series = trendSeries(daily, addDays(today, -(range - 1)), today).map((p) => ({
    date: p.date,
    value: p.value == null ? null : toDisplayWeight(p.value, unit),
    avg: p.avg == null ? null : toDisplayWeight(p.avg, unit),
  }));
  const hasSeries = series.filter((p) => p.value != null).length >= 2;

  // 圍度：最新值與上一次比較
  const circRows = CIRCUMFERENCES.map((c) => {
    const withC = metrics.filter((m) => m.circ[c] != null);
    const last = withC.at(-1);
    const prev = withC.at(-2);
    return { c, last, prev };
  }).filter((r) => r.last);

  return (
    <div className="flex flex-col gap-5 pb-4">
      <PageHeader
        title="身體"
        actions={
          <Link to="/photos" className="press flex h-10 items-center gap-1 rounded-md px-2 text-sm text-chalk-3 hover:bg-iron-2">
            進度照
            <Icon name="chevronRight" size={16} />
          </Link>
        }
      />

      <QuickWeight today={today} row={todayRow} unit={unit} />

      <div className="grid grid-cols-2 gap-2">
        <div className="card flex flex-col p-4">
          <span className="label">7 日平均</span>
          <span className="num text-h1 font-semibold">
            {avg7 != null ? dw(avg7, 2) : '–'}
            <span className="ml-1 text-sm font-normal text-chalk-3">{unit}</span>
          </span>
          <span className="text-cap text-chalk-4">{avg7 == null ? '7 天內記錄 4 次以上才計算' : '比單日體重穩定，看這個'}</span>
        </div>
        <div className="card flex flex-col p-4">
          <span className="label">週增重率</span>
          <span className="num text-h1 font-semibold">
            {rate != null ? `${rate >= 0 ? '+' : ''}${fmt(rate, 2)}` : '–'}
            <span className="ml-1 text-sm font-normal text-chalk-3">%</span>
          </span>
          <span className="text-cap text-chalk-4">目標 +{settings.nutrition.weeklyGainPct}%／週</span>
        </div>
      </div>
      {verdict && (
        <p
          className={`rounded-md px-4 py-3 text-sm ${verdict.verdict === 'ok' ? 'bg-go-soft text-go' : 'bg-warn-soft text-warn'}`}
          role="status"
        >
          <strong className="font-semibold">{{ ok: '剛好', slow: '偏慢', fast: '偏快', losing: '下降中' }[verdict.verdict]}：</strong>
          {verdict.advice}
        </p>
      )}

      <Section
        title="體重趨勢"
        action={
          <div className="w-44">
            <Segmented
              size="sm"
              ariaLabel="時間範圍"
              value={range}
              options={[
                { value: 30, label: '30 天' },
                { value: 90, label: '90 天' },
                { value: 365, label: '1 年' },
              ]}
              onChange={setRange}
            />
          </div>
        }
      >
        <div className="card p-3">
          {hasSeries ? (
            <Suspense fallback={<div className="h-64" />}>
              <WeightChart data={series} unit={unit} />
            </Suspense>
          ) : (
            <p className="p-6 text-center text-sm text-chalk-3">記錄兩天以上的體重就會出現趨勢圖。建議每天早上起床、上完廁所後量。</p>
          )}
        </div>
      </Section>

      <Section title="身體組成">
        <div className="card flex flex-col gap-3 p-4">
          {f ? (
            <div className="grid grid-cols-3 gap-3">
              <Stat label="體脂率" value={`${fmt(latestFat!.bodyFatPct!)}%`} />
              <Stat label="除脂體重" value={`${dw(f.lbmKg)} ${unit}`} />
              <Stat label="FFMI（校正）" value={fmt(f.normalized)} />
            </div>
          ) : (
            <p className="text-sm text-chalk-3">填入體脂率（體脂計或 InBody）後，會算出除脂體重與 FFMI。</p>
          )}
          {f && <p className="text-cap text-chalk-4">FFMI＝除脂體重 ÷ 身高²，再依身高校正；一般男性約 18–20，長期訓練約 21–23。體脂計的數字誤差不小，看趨勢比看單次準。</p>}
        </div>
      </Section>

      <Section title="圍度" action={<Button size="sm" icon="plus" onClick={() => setEdit({ date: today })}>記錄圍度</Button>}>
        {circRows.length ? (
          <div className="card grid grid-cols-2 gap-px overflow-hidden bg-seam sm:grid-cols-4">
            {circRows.map(({ c, last, prev }) => {
              const d = prev ? last!.circ[c]! - prev.circ[c]! : null;
              return (
                <div key={c} className="flex flex-col bg-iron p-3">
                  <span className="label">{CIRC_LABEL[c]}</span>
                  <span className="num text-h4 font-semibold">{fmt(last!.circ[c]!)} cm</span>
                  <span className="num text-cap text-chalk-4">
                    {d != null && d !== 0 ? `${d > 0 ? '+' : ''}${fmt(d)} cm · ` : ''}
                    {relativeDayLabel(last!.date, today)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="px-1 text-sm text-chalk-3">每 2–4 週量一次胸、上臂、腰、大腿圍。腰圍穩定而手臂、胸圍增加，代表增的多半是肌肉。</p>
        )}
      </Section>

      <Section title="紀錄">
        {metrics.length === 0 ? (
          <EmptyState icon="scale" title="還沒有身體數據" />
        ) : (
          <div className="card divide-y divide-seam overflow-hidden">
            {[...metrics].reverse().slice(0, 40).map((m) => (
              <div key={m.id} className="flex items-center gap-2 py-1 pr-1 pl-4">
                <button type="button" onClick={() => setEdit({ date: m.date })} className="press flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="num w-24 shrink-0 text-sm text-chalk-3">{shortDateLabel(m.date)}</span>
                  <span className="num min-w-0 flex-1 truncate">
                    {m.weightKg != null && <span className="font-semibold">{dw(m.weightKg)} {unit}</span>}
                    {m.bodyFatPct != null && <span className="ml-2 text-sm text-chalk-3">體脂 {fmt(m.bodyFatPct)}%</span>}
                    {Object.keys(m.circ).length > 0 && <span className="ml-2 text-sm text-chalk-3">圍度 {Object.keys(m.circ).length} 項</span>}
                  </span>
                </button>
                <IconButton
                  icon="trash"
                  label={`刪除 ${m.date}`}
                  onClick={async () => {
                    await db.bodyMetrics.delete(m.id);
                    toastUndo(`已刪除 ${shortDateLabel(m.date)} 的紀錄`, () => db.bodyMetrics.put(m));
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </Section>

      {edit && <MetricSheet date={edit.date} row={metrics.find((m) => m.date === edit.date)} unit={unit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="label">{label}</span>
      <span className="num truncate text-h4 font-semibold">{value}</span>
    </div>
  );
}

function QuickWeight({ today, row, unit }: { today: string; row: BodyMetric | undefined; unit: 'kg' | 'lb' }) {
  const [w, setW] = useState<number | null>(null);
  const shown = w ?? (row?.weightKg != null ? Number(toDisplayWeight(row.weightKg, unit).toFixed(1)) : null);
  const lo = Number(toDisplayWeight(LIMITS.weightKg[0], unit).toFixed(1));
  const hi = Number(toDisplayWeight(LIMITS.weightKg[1], unit).toFixed(1));
  const invalid = shown != null && (shown < lo || shown > hi);
  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold">今天的體重</p>
        {row?.weightKg != null && <span className="text-sm text-go">已記錄</span>}
      </div>
      <div className="flex gap-2">
        <NumberInput ariaLabel="今天的體重" value={shown} step={0.1} decimals={1} min={lo} max={hi} clamp={false} suffix={unit} stepper size="lg" className="flex-1" onChange={setW} />
      </div>
      {invalid && <p className="text-sm text-danger">請輸入 {lo}–{hi} {unit} 之間的體重</p>}
      <Button
        variant="primary"
        block
        disabled={shown == null || invalid || (w == null && row?.weightKg != null)}
        onClick={async () => {
          if (shown == null) return;
          await upsertBodyMetric(today, { weightKg: fromDisplayWeight(shown, unit) });
          setW(null);
          toast('已記錄體重');
        }}
      >
        {row?.weightKg != null ? '更新' : '記錄'}
      </Button>
    </div>
  );
}

function MetricSheet({ date: initialDate, row, unit, onClose }: { date: string; row: BodyMetric | undefined; unit: 'kg' | 'lb'; onClose: () => void }) {
  const [date, setDate] = useState(initialDate);
  const [weight, setWeight] = useState<number | null>(row?.weightKg != null ? Number(toDisplayWeight(row.weightKg, unit).toFixed(2)) : null);
  const [fat, setFat] = useState<number | null>(row?.bodyFatPct ?? null);
  const [circ, setCirc] = useState<Partial<Record<Circumference, number>>>(row?.circ ?? {});
  const [note, setNote] = useState(row?.note ?? '');
  const patch = {
    weightKg: weight == null ? null : fromDisplayWeight(weight, unit),
    bodyFatPct: fat,
    circ: Object.fromEntries(Object.entries(circ).filter(([, v]) => v != null)) as Partial<Record<Circumference, number>>,
    note: note.trim(),
  };
  const error = validateBodyPatch(patch);
  const targetHasData = useLiveQuery(async () => (date !== initialDate ? !!(await db.bodyMetrics.get(`body:${date}`)) : false), [date, initialDate]);
  return (
    <Sheet
      open
      onClose={onClose}
      title="身體數據"
      footer={
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!!error}
          onClick={async () => {
            // 編輯既有紀錄並改了日期 → 移動（刪除原日期）；新增則直接寫入
            if (row && date !== initialDate) await moveBodyMetric(initialDate, date, patch);
            else await upsertBodyMetric(date, patch);
            onClose();
          }}
        >
          儲存
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="日期" hint={row && date !== initialDate ? `會把這筆從 ${initialDate} 移到 ${date}` : undefined}>
          <input type="date" className="field" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
        {targetHasData && <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">{date} 已經有紀錄，儲存後會以這裡填的數值覆蓋。</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label={`體重（${unit}）`}>
            <NumberInput ariaLabel="體重" value={weight} decimals={2} min={Number(toDisplayWeight(LIMITS.weightKg[0], unit).toFixed(1))} max={Number(toDisplayWeight(LIMITS.weightKg[1], unit).toFixed(1))} clamp={false} onChange={setWeight} />
          </Field>
          <Field label="體脂率（%）">
            <NumberInput ariaLabel="體脂率" value={fat} decimals={1} min={LIMITS.bodyFatPct[0]} max={LIMITS.bodyFatPct[1]} clamp={false} onChange={setFat} />
          </Field>
        </div>
        <p className="label">圍度（cm）</p>
        <div className="grid grid-cols-2 gap-3">
          {CIRCUMFERENCES.map((c) => (
            <Field key={c} label={CIRC_LABEL[c]}>
              <NumberInput ariaLabel={CIRC_LABEL[c]} value={circ[c] ?? null} decimals={1} min={LIMITS.circCm[0]} max={LIMITS.circCm[1]} clamp={false} onChange={(v) => setCirc({ ...circ, [c]: v ?? undefined })} />
            </Field>
          ))}
        </div>
        <TextField label="備註" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
