import { useState } from 'react';
import { ACTIVITY_LEVELS, bmr, macroTargets, tdee, type Sex } from '../../core/nutrition';
import { e1rm, warmupSets } from '../../core/training/strength';
import { fmt, kgToLb, lbToKg, roundTo } from '../../core/units';
import { useSettings } from '../../db/repo/settings';
import { Field, NumberInput, Segmented } from '../../ui/Fields';
import { PageHeader } from '../../ui/Layout';
import { PlateCalculator } from '../workout/PlateBar';

type Tool = '1rm' | 'plates' | 'warmup' | 'tdee' | 'units';

export default function ToolsPage() {
  const settings = useSettings();
  const [tool, setTool] = useState<Tool>('1rm');
  if (!settings) return null;
  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader title="小工具" back="/more" />
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4" role="tablist" aria-label="工具">
        {(
          [
            ['1rm', '1RM'],
            ['plates', '槓片'],
            ['warmup', '暖身組'],
            ['tdee', 'TDEE'],
            ['units', 'kg ↔ lb'],
          ] as Array<[Tool, string]>
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tool === k}
            onClick={() => setTool(k)}
            className={`press h-9 shrink-0 rounded-full border px-4 text-sm font-medium ${tool === k ? 'border-chalk bg-chalk text-on-chalk' : 'border-seam text-chalk-2'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="card p-4">
        {tool === '1rm' && <OneRm />}
        {tool === 'plates' && <PlateCalculator initialKg={60} settings={settings} />}
        {tool === 'warmup' && <Warmup barKg={settings.equipment.barKg} />}
        {tool === 'tdee' && <TdeeTool />}
        {tool === 'units' && <Units />}
      </div>
    </div>
  );
}

function OneRm() {
  const [w, setW] = useState<number | null>(80);
  const [r, setR] = useState<number | null>(5);
  const ep = w && r ? e1rm(w, r, 'epley') : null;
  const br = w && r ? e1rm(w, r, 'brzycki') : null;
  const base = ep ?? 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="重量（kg）">
          <NumberInput ariaLabel="重量" value={w} decimals={2} min={0} max={500} onChange={setW} />
        </Field>
        <Field label="次數">
          <NumberInput ariaLabel="次數" value={r} decimals={0} min={1} max={30} onChange={setR} />
        </Field>
      </div>
      {ep == null ? (
        <p className="text-sm text-chalk-3">次數超過 12 下時估算誤差很大，請用較重、次數較少的組數估算。</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-well p-3">
              <p className="label">Epley</p>
              <p className="num text-h2 font-semibold">{fmt(ep)} kg</p>
            </div>
            <div className="rounded-md bg-well p-3">
              <p className="label">Brzycki</p>
              <p className="num text-h2 font-semibold">{fmt(br ?? 0)} kg</p>
            </div>
          </div>
          <table className="num w-full text-sm">
            <caption className="label pb-2 text-left">各次數大約能做的重量（依 Epley）</caption>
            <thead>
              <tr className="text-chalk-3">
                <th className="py-1 text-left font-normal">次數</th>
                <th className="py-1 text-right font-normal">重量</th>
                <th className="py-1 text-right font-normal">% 1RM</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => {
                const kg = n === 1 ? base : base / (1 + n / 30);
                return (
                  <tr key={n} className="border-t border-seam">
                    <td className="py-1.5">{n}</td>
                    <td className="py-1.5 text-right font-semibold">{fmt(roundTo(kg, 0.5))} kg</td>
                    <td className="py-1.5 text-right text-chalk-3">{fmt((kg / base) * 100, 0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function Warmup({ barKg }: { barKg: number }) {
  const [w, setW] = useState<number | null>(80);
  const [bar, setBar] = useState<'barbell' | 'none'>('barbell');
  const sets = w ? warmupSets(w, bar === 'barbell' ? barKg : 0, 2.5) : [];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="正式組重量（kg）">
          <NumberInput ariaLabel="正式組重量" value={w} decimals={2} min={0} max={500} onChange={setW} />
        </Field>
        <Field label="器材">
          <Segmented
            ariaLabel="器材"
            value={bar}
            options={[
              { value: 'barbell', label: '槓鈴' },
              { value: 'none', label: '啞鈴/器械' },
            ]}
            onChange={setBar}
          />
        </Field>
      </div>
      <ol className="flex flex-col gap-1.5">
        {sets.map((s, i) => (
          <li key={i} className="num flex justify-between rounded-md bg-well px-3 py-2">
            <span className="text-chalk-3">暖身 {i + 1}</span>
            <span className="font-semibold">
              {fmt(s.weightKg)} kg × {s.reps}
            </span>
          </li>
        ))}
        {w != null && (
          <li className="num flex justify-between rounded-md border border-seam-strong px-3 py-2">
            <span className="text-chalk-2">正式組</span>
            <span className="font-semibold">{fmt(w)} kg</span>
          </li>
        )}
      </ol>
      <p className="text-cap text-chalk-4">組間休息 30–60 秒即可，目的是熱身與練習動作，不要做到累。</p>
    </div>
  );
}

function TdeeTool() {
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState<number | null>(30);
  const [h, setH] = useState<number | null>(175);
  const [w, setW] = useState<number | null>(70);
  const [act, setAct] = useState(1.55);
  const ok = age && h && w;
  const b = ok ? bmr(sex, w!, h!, age!) : 0;
  const t = ok ? tdee(b, act) : 0;
  const m = ok
    ? macroTargets({ sex, weightKg: w!, heightCm: h!, age: age!, activity: act }, { mode: 'rate', weeklyGainPct: 0.3, surplusKcal: 0, proteinPerKg: 1.8, fatPct: 25, fatMinPerKg: 0.6 })
    : null;
  return (
    <div className="flex flex-col gap-4">
      <Segmented
        ariaLabel="生理性別"
        value={sex}
        options={[
          { value: 'male', label: '男' },
          { value: 'female', label: '女' },
        ]}
        onChange={setSex}
      />
      <div className="grid grid-cols-3 gap-3">
        <Field label="年齡">
          <NumberInput ariaLabel="年齡" value={age} decimals={0} min={10} max={100} onChange={setAge} />
        </Field>
        <Field label="身高 cm">
          <NumberInput ariaLabel="身高" value={h} decimals={1} min={100} max={250} onChange={setH} />
        </Field>
        <Field label="體重 kg">
          <NumberInput ariaLabel="體重" value={w} decimals={1} min={20} max={300} onChange={setW} />
        </Field>
      </div>
      <Field label="活動量">
        <select className="field" value={act} onChange={(e) => setAct(Number(e.target.value))}>
          {ACTIVITY_LEVELS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}（×{a.value}）
            </option>
          ))}
        </select>
      </Field>
      {ok && m && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md bg-well p-3">
            <p className="label">基礎代謝</p>
            <p className="num text-h3 font-semibold">{Math.round(b)}</p>
          </div>
          <div className="rounded-md bg-well p-3">
            <p className="label">每日消耗</p>
            <p className="num text-h3 font-semibold">{Math.round(t)}</p>
          </div>
          <div className="rounded-md bg-well p-3">
            <p className="label">增肌目標</p>
            <p className="num text-h3 font-semibold">{m.kcal}</p>
          </div>
        </div>
      )}
      <p className="text-cap text-chalk-4">Mifflin-St Jeor 公式；增肌目標以每週增加體重 0.3% 估算。這裡只是試算，不會改到你的設定。</p>
    </div>
  );
}

function Units() {
  const [kg, setKg] = useState<number | null>(20);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="公斤 kg">
        <NumberInput ariaLabel="公斤" value={kg} decimals={2} min={0} max={1000} onChange={setKg} />
      </Field>
      <Field label="磅 lb">
        <NumberInput ariaLabel="磅" value={kg == null ? null : Number(kgToLb(kg).toFixed(2))} decimals={2} min={0} max={2200} onChange={(v) => setKg(v == null ? null : lbToKg(v))} />
      </Field>
    </div>
  );
}
