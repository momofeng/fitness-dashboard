// 圖片尺寸計算（純函式）：等比縮小到長邊不超過 maxLong，不放大。

export function fitWithin(width: number, height: number, maxLong: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const long = Math.max(width, height);
  if (long <= maxLong) return { width: Math.round(width), height: Math.round(height) };
  const k = maxLong / long;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}
