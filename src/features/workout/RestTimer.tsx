import { useEffect, useRef, useState } from 'react';
import { setRestEndsAt } from '../../db/repo/workouts';
import type { Settings, Workout } from '../../db/schemas';
import { beep, notificationPermission, notify, requestNotification, vibrate } from '../../lib/platform';
import { Icon } from '../../ui/Icon';

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/**
 * 休息倒數：以結束時間戳計算，切到背景再回來也不會跑掉。
 * 時間到時震動＋響鈴；App 在背景時改送通知（不保證準時，瀏覽器會節流背景計時器）。
 */
export function RestTimer({ workout, settings }: { workout: Workout; settings: Settings }) {
  const endsAt = workout.restEndsAt;
  const [now, setNow] = useState(Date.now());
  const [perm, setPerm] = useState(notificationPermission());
  const alerted = useRef<number | null>(null);

  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 250);
    // 背景時盡量在時間到的那一刻送通知
    const ms = endsAt - Date.now();
    const bg = ms > 0 ? setTimeout(() => {
      if (document.hidden && alerted.current !== endsAt) {
        alerted.current = endsAt;
        void notify('休息結束', '開始下一組！');
        if (settings.training.vibrate) vibrate([300, 120, 300]);
      }
    }, ms) : undefined;
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(t);
      if (bg) clearTimeout(bg);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [endsAt, settings.training.vibrate]);

  const remaining = endsAt ? Math.ceil((endsAt - now) / 1000) : 0;

  useEffect(() => {
    if (!endsAt || remaining > 0 || alerted.current === endsAt) return;
    alerted.current = endsAt;
    // 已經超過很久（例如重新開啟 App）就不再提醒
    if (Date.now() - endsAt > 15_000) return;
    if (settings.training.vibrate) vibrate([300, 120, 300]);
    if (settings.training.sound) beep();
  }, [remaining, endsAt, settings.training.sound, settings.training.vibrate]);

  if (!endsAt) return null;
  const over = remaining <= 0;
  const total = Math.max(1, Math.round((endsAt - (workout.restStartedAt ?? endsAt - 120_000)) / 1000));
  const pct = over ? 100 : Math.min(100, Math.max(0, 100 - (remaining / total) * 100));

  return (
    <div
      className={`sticky top-[calc(56px+env(safe-area-inset-top))] z-10 -mx-4 border-b border-seam px-4 py-2 backdrop-blur ${over ? 'bg-go-soft' : 'bg-floor/95'}`}
      role="timer"
      aria-live="off"
      aria-label={over ? '休息結束' : `休息剩 ${mmss(remaining)}`}
    >
      <div className="flex items-center gap-2">
        <Icon name="timer" size={20} className={over ? 'text-go' : 'text-chalk-3'} />
        <span className={`num min-w-16 text-h2 font-semibold ${over ? 'text-go' : ''}`}>{over ? '開始！' : mmss(remaining)}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-chalk-3">{over ? `已過 ${mmss(-remaining)}` : '休息中'}</span>
        {!over && (
          <>
            <button type="button" className="press h-10 rounded-md border border-seam px-3 text-sm font-medium text-chalk-2" onClick={() => void setRestEndsAt(workout.id, endsAt - 15_000)}>
              −15
            </button>
            <button type="button" className="press h-10 rounded-md border border-seam px-3 text-sm font-medium text-chalk-2" onClick={() => void setRestEndsAt(workout.id, endsAt + 15_000)}>
              +15
            </button>
          </>
        )}
        <button type="button" className="press h-10 rounded-md px-3 text-sm font-medium text-chalk-3 hover:text-chalk" onClick={() => void setRestEndsAt(workout.id, null)}>
          {over ? '關閉' : '跳過'}
        </button>
      </div>
      {!over && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-iron-3">
          <div className="h-full rounded-full bg-chalk-2 transition-[width] duration-200 ease-linear" style={{ width: `${pct}%` }} />
        </div>
      )}
      {!over && (
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-cap text-chalk-3">
          切到其他 App 時提醒可能延遲，畫面留在這裡最準。
          {perm === 'default' && (
            <button
              type="button"
              className="text-chalk-3 underline decoration-chalk-4 underline-offset-2"
              onClick={async () => setPerm(await requestNotification())}
            >
              開啟背景通知
            </button>
          )}
        </p>
      )}
    </div>
  );
}
