import { MUSCLE_LABEL, MUSCLES } from '../../content/types';
import type { MuscleVolume } from '../../core/training/volume';
import { fmt } from '../../core/units';

/**
 * 每肌群每週組數：細橫條＋參考區間（淡色帶）。
 * 數值文字一律用中性墨色；「偏少／偏多」用文字標示，不只靠顏色。
 */
export function VolumeList({ volume, min, max, scaleNote }: { volume: MuscleVolume; min: number; max: number; scaleNote?: string }) {
  const top = Math.max(max * 1.25, ...MUSCLES.map((m) => volume[m]));
  const pct = (v: number) => `${(Math.min(v, top) / top) * 100}%`;
  return (
    <div className="flex flex-col gap-1.5">
      {MUSCLES.map((m) => {
        const v = volume[m];
        const status = v === 0 ? '' : v < min ? '偏少' : v > max ? '偏多' : '';
        return (
          <div key={m} className="grid grid-cols-[52px_1fr_64px] items-center gap-2">
            <span className="text-sm text-chalk-2">{MUSCLE_LABEL[m]}</span>
            <div className="relative h-2 rounded-full bg-iron-3" aria-hidden="true">
              <div className="absolute inset-y-0 rounded-full bg-seam-strong" style={{ left: pct(min), width: `calc(${pct(max)} - ${pct(min)})` }} />
              {v > 0 && (
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${v > max ? 'bg-warn' : v >= min ? 'bg-chalk' : 'bg-chalk-3'}`}
                  style={{ width: pct(v) }}
                />
              )}
            </div>
            <span className="num text-right text-sm">
              {fmt(v, 1)}
              {status && <span className={`ml-1 text-cap ${status === '偏多' ? 'text-warn' : 'text-chalk-4'}`}>{status}</span>}
            </span>
          </div>
        );
      })}
      <p className="pt-1 text-cap text-chalk-4">
        淡色帶是參考區間 {min}–{max} 組／週；主要肌群算 1 組、輔助肌群算 0.5 組。{scaleNote}
      </p>
    </div>
  );
}
