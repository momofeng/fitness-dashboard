import { useState, type ReactNode } from 'react';
import { ACTIVITY_LEVELS } from '../../core/nutrition';
import { fmt, fromDisplayWeight, toDisplayWeight } from '../../core/units';
import { DEFAULT_WARMUP } from '../../db/defaults';
import { LIMITS } from '../../db/limits';
import { updateSettings } from '../../db/repo/settings';
import type { Settings } from '../../db/schemas';
import { Button, IconButton } from '../../ui/Button';
import { Field, NumberInput, Segmented, TextField, Toggle } from '../../ui/Fields';
import { ListRow, PageHeader, Section } from '../../ui/Layout';
import { useTargets } from '../shared/useToday';

function Card({ children }: { children: ReactNode }) {
  return <div className="card flex flex-col gap-4 p-4">{children}</div>;
}

export default function SettingsPage() {
  const { settings: s, targets, weightKg } = useTargets();
  if (!s) return null;
  const set = updateSettings;

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title="設定" back="/more" />

      <Section title="資料">
        <div className="card overflow-hidden">
          <ListRow to="/settings/data">
            <p className="font-medium">資料與備份</p>
            <p className="text-sm text-chalk-3">匯出、匯入、CSV、儲存空間</p>
          </ListRow>
        </div>
      </Section>

      <Section title="個人資料">
        <Card>
          <TextField label="暱稱" value={s.profile.name} maxLength={40} onChange={(e) => set({ profile: { name: e.target.value } })} />
          <Field label="生理性別">
            <Segmented
              ariaLabel="生理性別"
              value={s.profile.sex}
              options={[
                { value: 'male', label: '男' },
                { value: 'female', label: '女' },
              ]}
              onChange={(v) => set({ profile: { sex: v } })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="出生年">
              <NumberInput ariaLabel="出生年" value={s.profile.birthYear} decimals={0} min={1930} max={2012} onChange={(v) => v != null && set({ profile: { birthYear: Math.round(v) } })} />
            </Field>
            <Field label="身高">
              <NumberInput ariaLabel="身高" value={s.profile.heightCm} suffix="cm" decimals={1} min={120} max={230} onChange={(v) => v != null && set({ profile: { heightCm: v } })} />
            </Field>
          </div>
          <Field label="活動量">
            <select className="field" value={s.profile.activity} onChange={(e) => set({ profile: { activity: Number(e.target.value) } })}>
              {ACTIVITY_LEVELS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}（×{a.value}）— {a.hint}
                </option>
              ))}
            </select>
          </Field>
          <Field label="重訓經驗">
            <Segmented
              ariaLabel="重訓經驗"
              value={s.profile.experience}
              options={[
                { value: 'novice', label: '未滿 1 年' },
                { value: 'intermediate', label: '1–3 年' },
                { value: 'advanced', label: '3 年以上' },
              ]}
              onChange={(v) => set({ profile: { experience: v } })}
            />
          </Field>
        </Card>
      </Section>

      <Section title="營養目標">
        <Card>
          {targets && weightKg ? (
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-md bg-well px-3 py-2.5">
              <span className="num text-h3 font-semibold">{targets.kcal.toLocaleString()} kcal</span>
              <span className="num text-sm text-chalk-3">
                蛋白質 {targets.protein} g · 碳水 {targets.carbs} g · 脂肪 {targets.fat} g
              </span>
              <span className="num w-full text-cap text-chalk-4">
                依最近體重 {fmt(weightKg)} kg 估算消耗 {targets.tdee.toLocaleString()} kcal
              </span>
            </div>
          ) : (
            <p className="text-sm text-chalk-3">記錄體重後才能計算目標。</p>
          )}
          <Field label="熱量盈餘的設定方式">
            <Segmented
              ariaLabel="熱量盈餘的設定方式"
              value={s.nutrition.mode}
              options={[
                { value: 'rate', label: '依增重速度' },
                { value: 'surplus', label: '直接指定' },
              ]}
              onChange={(v) => set({ nutrition: { mode: v } })}
            />
          </Field>
          {s.nutrition.mode === 'rate' ? (
            <Field label="每週增重（佔體重 %）" hint="新手建議 0.25–0.4%；盈餘會限制在 150–500 kcal。">
              <NumberInput ariaLabel="每週增重百分比" value={s.nutrition.weeklyGainPct} step={0.05} decimals={2} min={0} max={1.5} suffix="%" stepper onChange={(v) => v != null && set({ nutrition: { weeklyGainPct: v } })} />
            </Field>
          ) : (
            <Field label="每日盈餘">
              <NumberInput ariaLabel="每日盈餘" value={s.nutrition.surplusKcal} step={50} decimals={0} min={0} max={1500} suffix="kcal" stepper onChange={(v) => v != null && set({ nutrition: { surplusKcal: v } })} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="蛋白質" hint="建議 1.6–2.2">
              <NumberInput ariaLabel="蛋白質每公斤" value={s.nutrition.proteinPerKg} step={0.1} decimals={1} min={1} max={3.5} suffix="g/kg" onChange={(v) => v != null && set({ nutrition: { proteinPerKg: v } })} />
            </Field>
            <Field label="脂肪佔熱量" hint="建議 20–35%">
              <NumberInput ariaLabel="脂肪佔熱量百分比" value={s.nutrition.fatPct} step={1} decimals={0} min={10} max={50} suffix="%" onChange={(v) => v != null && set({ nutrition: { fatPct: v } })} />
            </Field>
            <Field label="脂肪下限" hint="不低於此值">
              <NumberInput ariaLabel="脂肪下限" value={s.nutrition.fatMinPerKg} step={0.1} decimals={1} min={0.3} max={2} suffix="g/kg" onChange={(v) => v != null && set({ nutrition: { fatMinPerKg: v } })} />
            </Field>
            <Field label="每日喝水目標">
              <NumberInput ariaLabel="每日喝水目標" value={s.nutrition.waterTargetMl} step={250} decimals={0} min={0} max={10000} suffix="ml" onChange={(v) => v != null && set({ nutrition: { waterTargetMl: v } })} />
            </Field>
          </div>
        </Card>
      </Section>

      <Section title="訓練">
        <Card>
          <Field label="1RM 估算公式">
            <Segmented
              ariaLabel="1RM 估算公式"
              value={s.training.e1rmFormula}
              options={[
                { value: 'epley', label: 'Epley' },
                { value: 'brzycki', label: 'Brzycki' },
              ]}
              onChange={(v) => set({ training: { e1rmFormula: v } })}
            />
          </Field>
          <Toggle label="記錄 RIR（保留次數）" hint="開啟後每組可填還能做幾下，估算 1RM 時一併考慮" checked={s.training.useRir} onChange={(v) => set({ training: { useRir: v } })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="預設休息">
              <NumberInput ariaLabel="預設休息秒數" value={s.training.defaultRestSec} step={15} decimals={0} min={0} max={900} suffix="秒" onChange={(v) => v != null && set({ training: { defaultRestSec: Math.round(v) } })} />
            </Field>
            <Field label="減量幅度" hint="減量時重量 ×">
              <NumberInput ariaLabel="減量後重量百分比" value={Math.round(s.training.deloadFactor * 100)} step={5} decimals={0} min={50} max={100} suffix="%" onChange={(v) => v != null && set({ training: { deloadFactor: v / 100 } })} />
            </Field>
            <Field label="線性進步：失敗幾次減量">
              <NumberInput ariaLabel="線性進步失敗次數" value={s.training.failsBeforeDeload} decimals={0} min={1} max={10} suffix="次" onChange={(v) => v != null && set({ training: { failsBeforeDeload: Math.round(v) } })} />
            </Field>
            <Field label="雙重進步：失敗幾次減量">
              <NumberInput ariaLabel="雙重進步失敗次數" value={s.training.doubleFailsBeforeDeload} decimals={0} min={1} max={10} suffix="次" onChange={(v) => v != null && set({ training: { doubleFailsBeforeDeload: Math.round(v) } })} />
            </Field>
            <Field label="停滯判定：連續幾次">
              <NumberInput ariaLabel="停滯判定次數" value={s.training.stallSessions} decimals={0} min={2} max={10} suffix="次" onChange={(v) => v != null && set({ training: { stallSessions: Math.round(v) } })} />
            </Field>
            <Field label="停滯判定：至少幾天">
              <NumberInput ariaLabel="停滯判定天數" value={s.training.stallMinDays} decimals={0} min={0} max={120} suffix="天" onChange={(v) => v != null && set({ training: { stallMinDays: Math.round(v) } })} />
            </Field>
            <Field label="停滯門檻" hint="最近幾次都沒超過先前最佳的這個 %，才算停滯">
              <NumberInput
                ariaLabel="停滯門檻百分比"
                value={s.training.stallThresholdPct}
                step={0.5}
                decimals={1}
                min={LIMITS.stallThresholdPct[0]}
                max={LIMITS.stallThresholdPct[1]}
                suffix="%"
                onChange={(v) => v != null && set({ training: { stallThresholdPct: v } })}
              />
            </Field>
            <Field label="每週組數參考下限">
              <NumberInput ariaLabel="每週組數下限" value={s.training.volumeMin} decimals={0} min={0} max={50} suffix="組" onChange={(v) => v != null && set({ training: { volumeMin: v } })} />
            </Field>
            <Field label="每週組數參考上限">
              <NumberInput ariaLabel="每週組數上限" value={s.training.volumeMax} decimals={0} min={0} max={60} suffix="組" onChange={(v) => v != null && set({ training: { volumeMax: v } })} />
            </Field>
          </div>
          <WarmupEditor s={s} />
          <Toggle label="訓練中螢幕保持亮著" checked={s.training.keepAwake} onChange={(v) => set({ training: { keepAwake: v } })} />
          <Toggle label="休息結束響鈴" checked={s.training.sound} onChange={(v) => set({ training: { sound: v } })} />
          <Toggle label="休息結束震動" checked={s.training.vibrate} onChange={(v) => set({ training: { vibrate: v } })} />
        </Card>
      </Section>

      <Section title="恢復與減量週">
        <Card>
          <div className="grid grid-cols-2 gap-3">
            <Field label="睡眠不足門檻" hint="近 7 天平均低於此值">
              <NumberInput ariaLabel="睡眠不足門檻" value={s.recovery.lowSleepH} step={0.5} decimals={1} min={LIMITS.lowSleepH[0]} max={LIMITS.lowSleepH[1]} suffix="時" onChange={(v) => v != null && set({ recovery: { lowSleepH: v } })} />
            </Field>
            <Field label="精力偏低門檻" hint="近 7 天平均不高於此值">
              <NumberInput ariaLabel="精力偏低門檻" value={s.recovery.lowEnergy} step={0.5} decimals={1} min={LIMITS.lowEnergy[0]} max={LIMITS.lowEnergy[1]} suffix="/5" onChange={(v) => v != null && set({ recovery: { lowEnergy: v } })} />
            </Field>
            <Field label="減量週組數" hint="原本組數的幾 %">
              <NumberInput ariaLabel="減量週組數百分比" value={s.recovery.deloadSetsPct} step={5} decimals={0} min={LIMITS.deloadSetsPct[0]} max={LIMITS.deloadSetsPct[1]} suffix="%" onChange={(v) => v != null && set({ recovery: { deloadSetsPct: Math.round(v) } })} />
            </Field>
            <Field label="減量週重量" hint="原本重量的幾 %">
              <NumberInput ariaLabel="減量週重量百分比" value={s.recovery.deloadWeightPct} step={5} decimals={0} min={LIMITS.deloadWeightPct[0]} max={LIMITS.deloadWeightPct[1]} suffix="%" onChange={(v) => v != null && set({ recovery: { deloadWeightPct: v } })} />
            </Field>
          </div>
        </Card>
      </Section>

      <Section title="器材">
        <EquipmentCard s={s} />
      </Section>

      <Section title="一般">
        <Card>
          <Field label="重量單位">
            <Segmented
              ariaLabel="重量單位"
              value={s.units.weight}
              options={[
                { value: 'kg', label: '公斤 kg' },
                { value: 'lb', label: '磅 lb' },
              ]}
              onChange={(v) => set({ units: { weight: v } })}
            />
          </Field>
          <Field label="主題">
            <Segmented
              ariaLabel="主題"
              value={s.theme}
              options={[
                { value: 'dark', label: '深色' },
                { value: 'light', label: '淺色' },
                { value: 'system', label: '跟隨系統' },
              ]}
              onChange={(v) => set({ theme: v })}
            />
          </Field>
          <Field label="日切換時間" hint={`凌晨 ${s.dayCutoffHour} 點前的紀錄算前一天（宵夜不會跑到隔天）`}>
            <NumberInput ariaLabel="日切換時間" value={s.dayCutoffHour} decimals={0} min={0} max={6} suffix="點" stepper onChange={(v) => v != null && set({ dayCutoffHour: Math.round(v) })} />
          </Field>
          <Field label="每週起始日">
            <Segmented
              ariaLabel="每週起始日"
              value={s.weekStart}
              options={[
                { value: 1, label: '週一' },
                { value: 0, label: '週日' },
              ]}
              onChange={(v) => set({ weekStart: v })}
            />
          </Field>
        </Card>
      </Section>
    </div>
  );
}

/** 暖身組方案：空槓次數＋各階段百分比與次數 */
function WarmupEditor({ s }: { s: Settings }) {
  const w = s.training.warmup;
  const save = (next: Settings['training']['warmup']) => updateSettings({ training: { warmup: next } });
  const setStep = (i: number, patch: Partial<{ pct: number; reps: number }>) => save({ ...w, steps: w.steps.map((st, j) => (j === i ? { ...st, ...patch } : st)) });
  const maxSteps = LIMITS.warmupSteps[1];
  return (
    <div className="flex flex-col gap-2 rounded-md border border-seam p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-chalk-2">暖身組（槓鈴複合動作）</p>
        <Button size="sm" variant="ghost" onClick={() => void save(structuredClone(DEFAULT_WARMUP))}>
          恢復預設
        </Button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] items-center gap-2">
        <span className="text-sm text-chalk-3">空槓</span>
        <NumberInput ariaLabel="空槓組次數" value={w.barReps} decimals={0} min={LIMITS.warmupBarReps[0]} max={LIMITS.warmupBarReps[1]} suffix="下" onChange={(v) => v != null && void save({ ...w, barReps: Math.round(v) })} />
        <span />
        {w.steps.map((st, i) => (
          <div key={i} className="contents">
            <NumberInput ariaLabel={`暖身第 ${i + 1} 步百分比`} value={st.pct} step={5} decimals={0} min={LIMITS.warmupPct[0]} max={LIMITS.warmupPct[1]} suffix="%" onChange={(v) => v != null && void setStep(i, { pct: Math.round(v) })} />
            <NumberInput ariaLabel={`暖身第 ${i + 1} 步次數`} value={st.reps} decimals={0} min={LIMITS.warmupReps[0]} max={LIMITS.warmupReps[1]} suffix="下" onChange={(v) => v != null && void setStep(i, { reps: Math.round(v) })} />
            <IconButton icon="x" label={`移除暖身第 ${i + 1} 步`} onClick={() => void save({ ...w, steps: w.steps.filter((_, j) => j !== i) })} />
          </div>
        ))}
      </div>
      <Button
        size="sm"
        icon="plus"
        disabled={w.steps.length >= maxSteps}
        onClick={() => void save({ ...w, steps: [...w.steps, { pct: Math.min(LIMITS.warmupPct[1], (w.steps.at(-1)?.pct ?? 30) + 10), reps: 2 }] })}
      >
        新增一步
      </Button>
      <p className="text-cap text-chalk-4">百分比是正式組重量的幾 %；與前一組差不到 10% 或太接近正式組的會自動略過。空槓填 0 表示不做空槓組。</p>
    </div>
  );
}

type PlateRow = { w: number; pairs: number };

function PlateList({ unit, plates, onChange }: { unit: 'kg' | 'lb'; plates: PlateRow[]; onChange: (next: PlateRow[]) => void }) {
  const [newW, setNewW] = useState<number | null>(null);
  const max = unit === 'lb' ? LIMITS.plateLb[1] : 50;
  const min = unit === 'lb' ? LIMITS.plateLb[0] : 0.25;
  const valid = newW != null && newW >= min && newW <= max && !plates.some((p) => p.w === newW);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-chalk-2">可用槓片（每種有幾對）</p>
      {plates.map((p, i) => (
        <div key={`${p.w}-${i}`} className="flex items-center gap-3">
          <span className="num w-20 shrink-0 font-semibold">
            {fmt(p.w, 2)} {unit}
          </span>
          <NumberInput
            ariaLabel={`${p.w} ${unit === 'lb' ? '磅' : '公斤'}槓片對數`}
            value={p.pairs}
            decimals={0}
            min={0}
            max={LIMITS.platePairs[1]}
            stepper
            suffix="對"
            className="flex-1"
            onChange={(v) => v != null && onChange(plates.map((q, j) => (j === i ? { ...q, pairs: Math.round(v) } : q)))}
          />
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <NumberInput ariaLabel="新增槓片重量" value={newW} decimals={2} min={0} max={max} suffix={unit} placeholder="其他重量" className="flex-1" onChange={setNewW} />
        <Button
          icon="plus"
          disabled={!valid}
          onClick={() => {
            if (valid) onChange([...plates, { w: newW, pairs: 2 }]);
            setNewW(null);
          }}
        >
          新增
        </Button>
      </div>
    </div>
  );
}

function EquipmentCard({ s }: { s: Settings }) {
  const lb = s.units.weight === 'lb';
  const sortDesc = (rows: PlateRow[]) => [...rows].sort((a, b) => b.w - a.w);
  return (
    <Card>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {lb ? (
          <Field label="槓重">
            <NumberInput ariaLabel="槓重" value={s.equipment.barLb} decimals={2} min={LIMITS.barLb[0]} max={LIMITS.barLb[1]} suffix="lb" onChange={(v) => v != null && updateSettings({ equipment: { barLb: v } })} />
          </Field>
        ) : (
          <Field label="槓重">
            <NumberInput ariaLabel="槓重" value={s.equipment.barKg} decimals={2} min={0} max={50} suffix="kg" onChange={(v) => v != null && updateSettings({ equipment: { barKg: v } })} />
          </Field>
        )}
        <Field label="EZ 槓重">
          <NumberInput
            ariaLabel="EZ 槓重"
            value={Number(toDisplayWeight(s.equipment.ezBarKg, s.units.weight).toFixed(2))}
            decimals={2}
            min={0}
            max={Number(toDisplayWeight(LIMITS.ezBarKg[1], s.units.weight).toFixed(2))}
            suffix={s.units.weight}
            onChange={(v) => v != null && updateSettings({ equipment: { ezBarKg: Math.min(LIMITS.ezBarKg[1], fromDisplayWeight(v, s.units.weight)) } })}
          />
        </Field>
        <Field label="啞鈴級距">
          <NumberInput ariaLabel="啞鈴級距" value={s.equipment.dumbbellStepKg} decimals={2} min={0.5} max={10} suffix="kg" onChange={(v) => v != null && updateSettings({ equipment: { dumbbellStepKg: v } })} />
        </Field>
        <Field label="器械級距">
          <NumberInput ariaLabel="器械級距" value={s.equipment.machineStepKg} decimals={2} min={0.5} max={20} suffix="kg" onChange={(v) => v != null && updateSettings({ equipment: { machineStepKg: v } })} />
        </Field>
      </div>
      {lb ? (
        <PlateList
          unit="lb"
          plates={s.equipment.platesLb.map((p) => ({ w: p.lb, pairs: p.pairs }))}
          onChange={(rows) => void updateSettings({ equipment: { platesLb: sortDesc(rows).map((r) => ({ lb: r.w, pairs: r.pairs })) } })}
        />
      ) : (
        <PlateList
          unit="kg"
          plates={s.equipment.plates.map((p) => ({ w: p.kg, pairs: p.pairs }))}
          onChange={(rows) => void updateSettings({ equipment: { plates: sortDesc(rows).map((r) => ({ kg: r.w, pairs: r.pairs })) } })}
        />
      )}
      <p className="text-cap text-chalk-4">{lb ? '磅制使用 lb 槓片計算配重；切回公斤會改用公斤槓片。' : '切換成磅制後會改用磅的槓片設定。'}</p>
    </Card>
  );
}
