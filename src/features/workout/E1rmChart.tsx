// e1RM 進步曲線（單一系列：不放圖例，標題已說明；十字游標＋提示框）。Recharts 只在這頁延遲載入。

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmt } from '../../core/units';

export interface E1rmPoint {
  date: string;
  value: number;
  detail: string;
}

export default function E1rmChart({ data, unit }: { data: E1rmPoint[]; unit: string }) {
  const values = data.map((d) => d.value);
  const lo = Math.floor(Math.min(...values) * 0.95);
  const hi = Math.ceil(Math.max(...values) * 1.03);
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--seam)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`}
            stroke="var(--chalk-4)"
            tick={{ fill: 'var(--chalk-3)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--seam-strong)' }}
            minTickGap={24}
          />
          <YAxis domain={[lo, hi]} tick={{ fill: 'var(--chalk-3)', fontSize: 11 }} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
          <Tooltip
            cursor={{ stroke: 'var(--chalk-4)', strokeWidth: 1 }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as E1rmPoint | undefined;
              if (!active || !p) return null;
              return (
                <div className="rounded-md border border-seam-strong bg-iron-3 px-3 py-2 text-sm">
                  <p className="text-chalk-3">{p.date}</p>
                  <p className="num font-semibold text-chalk">
                    估計 1RM {fmt(p.value)} {unit}
                  </p>
                  <p className="num text-chalk-2">{p.detail}</p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--chalk)"
            strokeWidth={2}
            dot={data.length <= 24 ? { r: 3, fill: 'var(--chalk)', stroke: 'var(--iron)', strokeWidth: 2 } : false}
            activeDot={{ r: 5, fill: 'var(--chalk)', stroke: 'var(--iron)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
