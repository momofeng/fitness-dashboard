import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useSettings } from '../db/repo/settings';
import { applyUpdate, dismissUpdate, useSwState } from '../lib/swUpdate';
import { Toaster } from '../ui/toast';

/** 套用主題、未完成首次設定就導向 onboarding、顯示更新提示 */
export function RootGate() {
  const settings = useSettings();
  const location = useLocation();
  const sw = useSwState();

  useEffect(() => {
    if (!settings) return;
    const apply = () => {
      const theme =
        settings.theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : settings.theme;
      document.documentElement.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f2f0eb' : '#0e0f11');
    };
    apply();
    if (settings.theme !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings?.theme, settings]);

  if (!settings) return <div className="min-h-dvh bg-floor" aria-busy="true" />;
  const onOnboarding = location.pathname.startsWith('/onboarding');
  if (!settings.onboarded && !onOnboarding) return <Navigate to="/onboarding" replace />;
  // 完成設定的瞬間，設定的即時查詢可能還沒更新而被彈回設定頁；更新後在這裡導回首頁，不會卡在第一步
  if (settings.onboarded && onOnboarding) return <Navigate to="/" replace />;

  return (
    <>
      <Outlet />
      {sw === 'update' && !location.pathname.startsWith('/train/session') && (
        <div className="fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-[max(8px,env(safe-area-inset-top))]">
          <div className="fade-enter flex max-w-md min-w-0 items-center gap-2 rounded-lg border border-seam-strong bg-iron-3 py-1.5 pr-1.5 pl-4">
            <span className="min-w-0 flex-1 text-base">有新版本可用</span>
            <button type="button" className="press h-9 rounded-sm px-3 text-chalk-3 hover:text-chalk" onClick={dismissUpdate}>
              稍後
            </button>
            <button type="button" className="press h-9 rounded-sm bg-chalk px-3 font-semibold text-on-chalk" onClick={applyUpdate}>
              更新
            </button>
          </div>
        </div>
      )}
      <Toaster />
    </>
  );
}
