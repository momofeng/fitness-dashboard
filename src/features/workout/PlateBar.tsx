// 槓片示意：用奧運槓片的實體顏色畫出「每側要放哪些」。這是實物的顏色，不是資料系列色。

import { plateLoadout, type PlateStock } from '../../core/training/strength';
import { fmt } from '../../core/units';

const PLATE_STYLE: Record<string, { color: string; h: number; w: number; label: string }> = {
  '25': { color: '#e5534b', h: 100, w: 13, label: '#fff' },
  '20': { color: '#4c8df6', h: 100, w: 12, label: '#fff' },
  '15': { color: '#e9b949', h: 90, w: 11, label: '#111' },
  '10': { color: '#46b864', h: 80, w: 10, label: '#111' },
  '5': { color: '#edebe6', h: 58, w: 8, label: '#111' },
  '2.5': { color: '#c4473f', h: 46, w: 7, label: '#fff' },
  '1.25': { color: '#a9a7a1', h: 38, w: 6, label: '#111' },
};

function plateStyle(kg: number) {
  return PLATE_STYLE[String(kg)] ?? { color: '#85837d', h: Math.max(30, Math.min(100, kg * 4)), w: 7, label: '#111' };
}

export function PlateBar({ targetKg, barKg, stock, compact = false }: { targetKg: number; barKg: number; stock: PlateStock[]; compact?: boolean }) {
  const r = plateLoadout(targetKg, barKg, stock);
  const height = compact ? 28 : 56;
  if (targetKg <= barKg) {
    return <p className="text-sm text-chalk-3">{targetKg === barKg ? '空槓即可' : `低於槓重 ${fmt(barKg)} kg`}</p>;
  }
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className="flex shrink-0 items-center"
        role="img"
        aria-label={`每側：${r.perSide.map((p) => `${fmt(p, 2)} kg`).join('、') || '不用加片'}`}
        style={{ height }}
      >
        {/* 槓袖 */}
        <span className="h-[18%] w-3 rounded-l-sm bg-chalk-3" />
        <span className="h-[34%] w-1 bg-chalk-2" />
        {r.perSide.map((kg, i) => {
          const s = plateStyle(kg);
          return (
            <span
              key={i}
              className="mx-px rounded-[2px]"
              style={{ background: s.color, height: `${s.h}%`, width: compact ? s.w * 0.7 : s.w }}
              title={`${kg} kg`}
            />
          );
        })}
        <span className="h-[18%] w-4 rounded-r-sm bg-chalk-3" />
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="num text-base font-semibold">每側 {r.perSide.length ? r.perSide.map((p) => fmt(p, 2)).join(' + ') : '—'}</p>
          <p className="num text-sm text-chalk-3">
            {r.exact ? `含 ${fmt(barKg)} kg 槓 = ${fmt(r.achievedKg, 2)} kg` : `湊不出，最接近 ${fmt(r.achievedKg, 2)} kg`}
          </p>
        </div>
      )}
    </div>
  );
}
