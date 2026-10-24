import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { db } from '../db/db';
import { Icon, type IconName } from '../ui/Icon';

const NAV: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: '/', label: '首頁', icon: 'home', end: true },
  { to: '/train', label: '訓練', icon: 'dumbbell' },
  { to: '/eat', label: '飲食', icon: 'bowl' },
  { to: '/body', label: '身體', icon: 'body' },
  { to: '/more', label: '更多', icon: 'more' },
];

function elapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

/** 進行中的訓練：任何頁面都看得到，一鍵回去 */
function ActiveWorkoutPill() {
  const active = useLiveQuery(() => db.workouts.where('status').equals('active').first(), []);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  if (!active) return null;
  return (
    <Link
      to={`/train/session/${active.id}`}
      className="press fixed inset-x-4 bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 mx-auto flex h-12 max-w-md items-center gap-3 rounded-lg bg-chalk px-4 text-on-chalk md:bottom-6 md:left-64"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-go opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-go" />
      </span>
      <span className="min-w-0 flex-1 truncate font-semibold">{active.dayName || '訓練'}進行中</span>
      <span className="num font-semibold">{elapsed(now - active.startedAt)}</span>
      <Icon name="chevronRight" size={18} />
    </Link>
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-dvh md:flex">
      {/* 桌面側欄：與畫布同底色，只用一條縫線分隔 */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r border-seam px-3 py-5 md:flex">
        <div className="mb-4 px-3">
          <p className="text-h4 font-semibold">增肌日誌</p>
          <p className="text-sm text-chalk-3">訓練 · 飲食 · 身體</p>
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `press flex h-11 items-center gap-3 rounded-md px-3 font-medium ${isActive ? 'bg-iron-2 text-chalk' : 'text-chalk-3 hover:bg-iron hover:text-chalk-2'}`
            }
          >
            <Icon name={n.icon} />
            {n.label}
          </NavLink>
        ))}
      </aside>

      <main className="mx-auto w-full max-w-5xl min-w-0 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] md:px-8 md:pb-12">
        <Outlet />
      </main>

      <ActiveWorkoutPill />

      {/* 手機底部分頁 */}
      <nav
        aria-label="主要分頁"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-seam bg-floor/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `press flex h-16 flex-col items-center justify-center gap-1 text-cap font-medium ${isActive ? 'text-chalk' : 'text-chalk-4'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={n.icon} size={22} strokeWidth={isActive ? 2.1 : 1.75} />
                {n.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
