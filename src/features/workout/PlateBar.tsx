// 槓片示意：用槓片的實體顏色畫出「每側要放哪些」。這是實物的顏色，不是資料系列色。
// 公斤用奧運槓片色；磅用常見 lb 包膠槓片的顏色。數值單位一律是傳進來的 unit。

import { useState } from 'react';
import { plateLoadout, type PlateStock } from '../../core/training/strength';
import { fmt, type WeightUnit } from '../../core/units';
import type { Settings } from '../../db/schemas';
import { Field, NumberInput } from '../../ui/Fields';
import { plateSetup } from './plates';

type PlateLook = { color: string; h: number; w: number };

const PLATE_STYLE_KG: Record<string, PlateLook> = {
  '25': { color: '#e5534b', h: 100, w: 13 },
  '20': { color: '#4c8df6', h: 100, w: 12 },
  '15': { color: '#e9b949', h: 90, w: 11 },
  '10': { color: '#46b864', h: 80, w: 10 },
  '5': { color: '#edebe6', h: 58, w: 8 },
  '2.5': { color: '#c4473f', h: 46, w: 7 },
  '1.25': { color: '#a9a7a1', h: 38, w: 6 },
};

const PLATE_STYLE_LB: Record<string, PlateLook> = {
  '55': { color: '#e5534b', h: 100, w: 13 },
  '45': { color: '#4c8df6', h: 100, w: 12 },
  '35': { color: '#e9b949', h: 90, w: 11 },
  '25': { color: '#46b864', h: 80, w: 10 },
  '10': { color: '#edebe6', h: 62, w: 8 },
  '5': { color: '#c4473f', h: 48, w: 7 },
  '2.5': { color: '#a9a7a1', h: 38, w: 6 },
};

function plateStyle(w: number, unit: WeightUnit): PlateLook {
  const map = unit === 'lb' ? PLATE_STYLE_LB : PLATE_STYLE_KG;
  const perKg = unit === 'lb' ? 1.8 : 4;
  return map[String(w)] ?? { color: '#85837d', h: Math.max(30, Math.min(100, w * perKg)), w: 7 };
}

export function PlateBar({
  target,
  bar,
  stock,
  unit = 'kg',
  compact = false,
}: {
  target: number;
  bar: number;
  stock: PlateStock[];
  unit?: WeightUnit;
  compact?: boolean;
}) {
  const r = plateLoadout(target, bar, stock);
  const height = compact ? 28 : 56;
  if (target <= bar) {
    return <p className="text-sm text-chalk-3">{target === bar ? '空槓即可' : `低於槓重 ${fmt(bar)} ${unit}`}</p>;
  }
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className="flex shrink-0 items-center"
        role="img"
        aria-label={`每側：${r.perSide.map((p) => `${fmt(p, 2)} ${unit}`).join('、') || '不用加片'}`}
        style={{ height }}
      >
        {/* 槓袖 */}
        <span className="h-[18%] w-3 rounded-l-sm bg-chalk-3" />
        <span className="h-[34%] w-1 bg-chalk-2" />
        {r.perSide.map((w, i) => {
          const s = plateStyle(w, unit);
          return (
            <span
              key={i}
              className="mx-px rounded-[2px]"
              style={{ background: s.color, height: `${s.h}%`, width: compact ? s.w * 0.7 : s.w }}
              title={`${w} ${unit}`}
            />
          );
        })}
        <span className="h-[18%] w-4 rounded-r-sm bg-chalk-3" />
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="num text-base font-semibold">每側 {r.perSide.length ? `${r.perSide.map((p) => fmt(p, 2)).join(' + ')} ${unit}` : '—'}</p>
          <p className="num text-sm text-chalk-3">
            {r.exact ? `含 ${fmt(bar, 2)} ${unit} 槓 = ${fmt(r.achievedKg, 2)} ${unit}` : `湊不出，最接近 ${fmt(r.achievedKg, 2)} ${unit}`}
          </p>
        </div>
      )}
    </div>
  );
}

/** 槓片計算機：initialKg 以公斤傳入，畫面依使用者單位顯示 */
export function PlateCalculator({ initialKg, settings, equipment = 'barbell' }: { initialKg: number; settings: Settings; equipment?: 'barbell' | 'ezbar' }) {
  const setup = plateSetup(settings, equipment);
  const [total, setTotal] = useState<number | null>(setup.toUnit(initialKg));
  const [bar, setBar] = useState<number | null>(setup.bar);
  const u = setup.unit;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={`總重量（${u}）`}>
          <NumberInput ariaLabel="總重量" value={total} step={u === 'lb' ? 5 : 2.5} decimals={2} min={0} max={u === 'lb' ? 1100 : 500} stepper onChange={setTotal} />
        </Field>
        <Field label={`槓重（${u}）`}>
          <NumberInput ariaLabel="槓重" value={bar} step={5} decimals={2} min={0} max={u === 'lb' ? 100 : 50} onChange={setBar} />
        </Field>
      </div>
      {total != null && bar != null && (
        <div className="rounded-lg bg-well p-4">
          <PlateBar target={total} bar={bar} stock={setup.stock} unit={u} />
        </div>
      )}
      <p className="text-sm text-chalk-3">依「設定 → 器材」裡的{u === 'lb' ? '磅制' : ''}槓片數量計算。</p>
    </div>
  );
}
