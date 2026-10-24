// 體重趨勢：每日體重（淡色點）＋ 7 日均線（實線）。兩個系列 → 一定有圖例；同一個 y 軸。

import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { fmt } from '../../core/units';

export interface WeightPoint {
  date: string;
  value: number | null;
  avg: number | null;
}

export default function WeightChart({ data, unit }: { data: WeightPoint[]; unit: string }) {
  const nums = data.flatMap((d) => [d.value, d.avg]).filter((v): v is number => v != null);
  const lo = Math.floor((Math.min(...nums) - 0.5) * 2) / 2;
  const hi = Math.ceil((Math.max(...nums) + 0.5) * 2) / 2;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 text-sm text-chalk-3" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-chalk-4" />
          每日體重
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-chalk" />7 日均線
        </span>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--seam)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`}
              tick={{ fill: 'var(--chalk-3)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--seam-strong)' }}
              minTickGap={28}
            />
            <YAxis domain={[lo, hi]} tick={{ fill: 'var(--chalk-3)', fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => fmt(v)} />
            <Tooltip
              cursor={{ stroke: 'var(--chalk-4)', strokeWidth: 1 }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as WeightPoint | undefined;
                if (!active || !p) return null;
                return (
                  <div className="rounded-md border border-seam-strong bg-iron-3 px-3 py-2 text-sm">
                    <p className="text-chalk-3">{p.date}</p>
                    <p className="num text-chalk">體重 {p.value != null ? `${fmt(p.value)} ${unit}` : '未記錄'}</p>
                    {p.avg != null && <p className="num text-chalk-2">7 日均 {fmt(p.avg, 2)} {unit}</p>}
                  </div>
                );
              }}
            />
            <Scatter dataKey="value" fill="var(--chalk-4)" shape={(props: { cx?: number; cy?: number }) => (props.cx != null && props.cy != null ? <circle cx={props.cx} cy={props.cy} r={3.5} fill="var(--chalk-4)" stroke="var(--iron)" strokeWidth={2} /> : <g />)} isAnimationActive={false} />
            <Line type="monotone" dataKey="avg" stroke="var(--chalk)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
