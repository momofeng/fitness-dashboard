// 恢復紀錄的共用元件：今天的睡眠／精力／痠痛輸入、減量建議卡、減量週橫幅。

import { useState } from 'react';
import { SORE_AREA_LABEL, SORE_AREAS, type SoreArea } from '../../content/types';
import { shortDateLabel } from '../../core/dates';
import type { DeloadAdvice } from '../../core/recovery';
import { inRange, LIMITS } from '../../db/limits';
import { useDailyLog } from '../../db/repo/foods';
import { endDeloadWeek, isDeloadActive, restoreDeloadUntil, setDailyRecovery, startDeloadWeek } from '../../db/repo/recovery';
import type { Settings } from '../../db/schemas';
import { Button } from '../../ui/Button';
import { Field, NumberInput } from '../../ui/Fields';
import { Icon } from '../../ui/Icon';
import { toast } from '../../ui/toast';

export const ENERGY_LABEL = ['', '很累', '偏累', '普通', '不錯', '很好'] as const;

/** 今天的恢復狀態：睡眠時數、精力 1–5、選填痠痛部位 */
export function RecoveryEntry({ date, compact = false }: { date: string; compact?: boolean }) {
  const log = useDailyLog(date);
  const [sleep, setSleep] = useState<number | null | undefined>(undefined);
  const [soreOpen, setSoreOpen] = useState(false);
  if (log === undefined) return <div aria-busy="true" className="h-24" />;
  const sleepValue = sleep !== undefined ? sleep : (log?.sleepHours ?? null);
  const sleepBad = sleepValue != null && !inRange('sleepH', sleepValue);
  const sore = (log?.soreness ?? []) as SoreArea[];
  const save = (patch: Parameters<typeof setDailyRecovery>[1]) =>
    setDailyRecovery(date, patch).catch((e: unknown) => toast(e instanceof Error ? e.message : String(e), { tone: 'error' }));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <Field label="睡了幾小時" error={sleepBad ? `請輸入 ${LIMITS.sleepH[0]}–${LIMITS.sleepH[1]} 小時` : null}>
          <NumberInput
            ariaLabel="睡眠時數"
            value={sleepValue}
            step={0.5}
            decimals={2}
            min={LIMITS.sleepH[0]}
            max={LIMITS.sleepH[1]}
            clamp={false}
            stepper
            suffix="時"
            placeholder="例如 7"
            onChange={setSleep}
            onCommit={(v) => {
              // 離開欄位或按 −／＋ 才存，而且只存合法值（逐字輸入時中間值不會被寫進去）
              if (v == null) void save({ sleepHours: null });
              else if (inRange('sleepH', v)) void save({ sleepHours: v });
            }}
          />
        </Field>
        <Field label="今天精力">
          <div role="radiogroup" aria-label="今天精力" className="grid grid-cols-5 gap-1">
            {[1, 2, 3, 4, 5].map((n) => {
              const on = log?.energy === n;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`${n} ${ENERGY_LABEL[n]}`}
                  title={ENERGY_LABEL[n]}
                  onClick={() => void save({ energy: on ? null : n })}
                  className={`press flex h-11 flex-col items-center justify-center rounded-md border text-sm font-semibold ${on ? 'border-chalk bg-chalk text-on-chalk' : 'border-seam bg-iron-2 text-chalk-2'}`}
                >
                  <span className="num leading-none">{n}</span>
                  <span className={`text-cap font-normal leading-none ${on ? '' : 'text-chalk-3'}`}>{ENERGY_LABEL[n]}</span>
                </button>
              );
            })}
          </div>
        </Field>
      </div>
      <div>
        <button type="button" onClick={() => setSoreOpen((v) => !v)} aria-expanded={soreOpen} className="press flex h-9 items-center gap-1 text-sm text-chalk-3 hover:text-chalk-2">
          <Icon name={soreOpen ? 'chevronDown' : 'chevronRight'} size={16} />
          痠痛部位（選填）{sore.length > 0 && `：${[...sore].sort((a, b) => SORE_AREAS.indexOf(a) - SORE_AREAS.indexOf(b)).map((a) => SORE_AREA_LABEL[a]).join('、')}`}
        </button>
        {soreOpen && (
          <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="痠痛部位">
            {SORE_AREAS.map((a) => {
              const on = sore.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  aria-pressed={on}
                  onClick={() => void save({ soreness: on ? sore.filter((x) => x !== a) : [...sore, a] })}
                  className={`press h-9 rounded-full border px-3 text-sm ${on ? 'border-chalk bg-chalk font-medium text-on-chalk' : 'border-seam text-chalk-2'}`}
                >
                  {SORE_AREA_LABEL[a]}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** 減量週進行中的橫幅 */
export function DeloadBanner({ settings, today }: { settings: Settings; today: string }) {
  const until = settings.recovery.deloadUntil;
  const [confirm, setConfirm] = useState(false);
  if (!until || !isDeloadActive(until, today)) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-seam-strong bg-go-soft p-3" role="status">
      <Icon name="info" className="shrink-0 text-go" />
      <p className="min-w-0 flex-1 text-sm text-chalk">
        減量週進行中，到 {shortDateLabel(until)} 為止：新開的訓練組數約 {settings.recovery.deloadSetsPct}%、重量約 {settings.recovery.deloadWeightPct}%，不會改變進步紀錄。
      </p>
      <Button
        size="sm"
        variant={confirm ? 'danger' : 'secondary'}
        onClick={async () => {
          if (!confirm) return setConfirm(true);
          const prev = await endDeloadWeek(today);
          setConfirm(false);
          toast('已提前結束減量週', { actionLabel: '復原', onAction: () => void restoreDeloadUntil(prev) });
        }}
      >
        {confirm ? '確定結束' : '提前結束'}
      </Button>
    </div>
  );
}

/** 減量建議卡；level=ok 時不顯示 */
export function AdviceCard({ advice, today, showOk = false }: { advice: DeloadAdvice; today: string; showOk?: boolean }) {
  if (advice.level === 'ok' && !showOk) return null;
  const tone = advice.level === 'deload' ? 'border-seam-strong bg-warn-soft' : 'border-seam bg-iron';
  return (
    <section className={`flex flex-col gap-2 rounded-lg border p-4 ${tone}`} aria-label="減量建議">
      <p className="flex items-center gap-2 font-semibold">
        {advice.level === 'ok' && advice.actions.length === 0 ? (
          <Icon name="check" size={18} className="text-go" />
        ) : (
          <Icon name="info" size={18} className={advice.level === 'ok' ? 'text-chalk-3' : 'text-warn'} />
        )}
        {advice.title}
      </p>
      {advice.reasons.length > 0 && <p className="text-sm text-chalk-2">{advice.reasons.join('；')}。</p>}
      {advice.actions.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-chalk-2">
          {advice.actions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      {advice.offerDeload && (
        <Button variant="primary" block onClick={() => void startDeloadWeek(today).then(() => toast('已開始減量週，接下來 7 天新開的訓練會自動減量'))}>
          開始減量週（7 天）
        </Button>
      )}
    </section>
  );
}
