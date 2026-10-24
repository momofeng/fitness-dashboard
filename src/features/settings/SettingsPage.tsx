import { useState, type ReactNode } from 'react';
import { ACTIVITY_LEVELS } from '../../core/nutrition';
import { fmt } from '../../core/units';
import { updateSettings } from '../../db/repo/settings';
import type { Settings } from '../../db/schemas';
import { Button } from '../../ui/Button';
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
            <Field label="每週組數參考下限">
              <NumberInput ariaLabel="每週組數下限" value={s.training.volumeMin} decimals={0} min={0} max={50} suffix="組" onChange={(v) => v != null && set({ training: { volumeMin: v } })} />
            </Field>
            <Field label="每週組數參考上限">
              <NumberInput ariaLabel="每週組數上限" value={s.training.volumeMax} decimals={0} min={0} max={60} suffix="組" onChange={(v) => v != null && set({ training: { volumeMax: v } })} />
            </Field>
          </div>
          <Toggle label="訓練中螢幕保持亮著" checked={s.training.keepAwake} onChange={(v) => set({ training: { keepAwake: v } })} />
          <Toggle label="休息結束響鈴" checked={s.training.sound} onChange={(v) => set({ training: { sound: v } })} />
          <Toggle label="休息結束震動" checked={s.training.vibrate} onChange={(v) => set({ training: { vibrate: v } })} />
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

function EquipmentCard({ s }: { s: Settings }) {
  const [newKg, setNewKg] = useState<number | null>(null);
  const plates = s.equipment.plates;
  const setPlates = (next: Settings['equipment']['plates']) => updateSettings({ equipment: { plates: [...next].sort((a, b) => b.kg - a.kg) } });
  return (
    <Card>
      <div className="grid grid-cols-3 gap-3">
        <Field label="槓重">
          <NumberInput ariaLabel="槓重" value={s.equipment.barKg} decimals={2} min={0} max={50} suffix="kg" onChange={(v) => v != null && updateSettings({ equipment: { barKg: v } })} />
        </Field>
        <Field label="啞鈴級距">
          <NumberInput ariaLabel="啞鈴級距" value={s.equipment.dumbbellStepKg} decimals={2} min={0.5} max={10} suffix="kg" onChange={(v) => v != null && updateSettings({ equipment: { dumbbellStepKg: v } })} />
        </Field>
        <Field label="器械級距">
          <NumberInput ariaLabel="器械級距" value={s.equipment.machineStepKg} decimals={2} min={0.5} max={20} suffix="kg" onChange={(v) => v != null && updateSettings({ equipment: { machineStepKg: v } })} />
        </Field>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-chalk-2">可用槓片（每種有幾對）</p>
        {plates.map((p, i) => (
          <div key={`${p.kg}-${i}`} className="flex items-center gap-3">
            <span className="num w-20 shrink-0 font-semibold">{fmt(p.kg, 2)} kg</span>
            <NumberInput
              ariaLabel={`${p.kg} 公斤槓片對數`}
              value={p.pairs}
              decimals={0}
              min={0}
              max={20}
              stepper
              suffix="對"
              className="flex-1"
              onChange={(v) => v != null && setPlates(plates.map((q, j) => (j === i ? { ...q, pairs: Math.round(v) } : q)))}
            />
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <NumberInput ariaLabel="新增槓片重量" value={newKg} decimals={2} min={0} max={50} suffix="kg" placeholder="其他重量" className="flex-1" onChange={setNewKg} />
          <Button
            icon="plus"
            disabled={!newKg || newKg <= 0 || plates.some((p) => p.kg === newKg)}
            onClick={() => {
              if (newKg && newKg > 0) setPlates([...plates, { kg: newKg, pairs: 2 }]);
              setNewKg(null);
            }}
          >
            新增
          </Button>
        </div>
      </div>
    </Card>
  );
}
