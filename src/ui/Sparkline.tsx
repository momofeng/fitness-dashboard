// 首頁用的小趨勢線（手寫 SVG，不載入圖表套件）。只畫形狀，數字由旁邊的文字負責。

export function Sparkline({ values, width = 120, height = 36, label }: { values: Array<number | null>; width?: number; height?: number; label: string }) {
  const pts = values.map((v, i) => ({ i, v })).filter((p): p is { i: number; v: number } => p.v != null);
  if (pts.length < 2) return null;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const span = max - min || 1;
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * (width - 4) + 2;
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const last = pts.at(-1)!;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="shrink-0">
      <path d={d} fill="none" stroke="var(--chalk-2)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(last.i)} cy={y(last.v)} r={3} fill="var(--chalk)" stroke="var(--iron)" strokeWidth={1.5} />
    </svg>
  );
}
