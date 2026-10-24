import type { MacroTargets, Nutrients } from '../../core/nutrition';
import { fmt } from '../../core/units';
import { Meter } from '../../ui/Layout';

/** 三大營養素：色點＋名稱（不只靠顏色辨識）、數字用中性墨色、細進度條 */
export function MacroBars({ total, targets, compact = false }: { total: Required<Nutrients>; targets: MacroTargets; compact?: boolean }) {
  const rows = [
    { key: 'protein', label: '蛋白質', v: total.protein, t: targets.protein, color: 'var(--protein)' },
    { key: 'carbs', label: '碳水', v: total.carbs, t: targets.carbs, color: 'var(--carbs)' },
    { key: 'fat', label: '脂肪', v: total.fat, t: targets.fat, color: 'var(--fat)' },
  ];
  return (
    <div className={`grid grid-cols-3 ${compact ? 'gap-3' : 'gap-4'}`}>
      {rows.map((r) => (
        <div key={r.key} className="flex min-w-0 flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-sm text-chalk-3">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} />
            {r.label}
          </span>
          <span className="num truncate">
            <span className={`${compact ? 'text-h4' : 'text-h3'} font-semibold`}>{fmt(r.v, 0)}</span>
            <span className="text-sm text-chalk-3"> / {r.t} g</span>
          </span>
          <Meter value={r.v} max={r.t} color={r.color} label={`${r.label} ${fmt(r.v, 0)} / ${r.t} 公克`} height={4} />
        </div>
      ))}
    </div>
  );
}

/** 焦點數字：還可以吃多少（或已超過多少） */
export function KcalHero({ eaten, target, size = 'lg' }: { eaten: number; target: number; size?: 'lg' | 'md' }) {
  const left = Math.round(target - eaten);
  const over = left < 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="label">{over ? '已超過目標' : '今天還可以吃'}</p>
          <p className={`num font-semibold ${size === 'lg' ? 'text-display' : 'text-h1'}`}>
            {Math.abs(left).toLocaleString()}
            <span className="ml-1.5 text-h4 font-medium text-chalk-3">kcal</span>
          </p>
        </div>
        <p className="num shrink-0 pb-1 text-right text-sm text-chalk-3">
          已吃 <span className="font-semibold text-chalk">{Math.round(eaten).toLocaleString()}</span>
          <br />
          目標 {target.toLocaleString()}
        </p>
      </div>
      <Meter value={eaten} max={target} label={`熱量 ${Math.round(eaten)} / ${target} 大卡`} height={6} />
    </div>
  );
}
