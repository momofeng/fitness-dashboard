import type { ReactNode } from 'react';
import { Link, useNavigate, type NavigateFunction } from 'react-router';
import { Icon } from './Icon';

/**
 * 回上一頁；App 內沒有上一頁（直接開網址、重新整理）時，以 fallback 取代目前這頁，
 * 不疊新的紀錄，避免兩頁之間互相「返回」打轉。
 */
export function goBackOr(navigate: NavigateFunction, fallback: string) {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
  if (idx > 0) void navigate(-1);
  else void navigate(fallback, { replace: true });
}

/**
 * 頁面標題列：手機上是頁首，桌面上與內容同寬。
 * 返回：App 內有上一頁就回上一頁（從首頁點進恢復頁，返回回到首頁）；直接開啟網址時才去 back 指定的頁面。
 */
export function PageHeader({ title, back, actions, sub }: { title: ReactNode; back?: string; actions?: ReactNode; sub?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="flex min-h-14 items-center gap-2 pt-[max(8px,env(safe-area-inset-top))] pb-2">
      {back && (
        <Link
          to={back}
          aria-label="返回"
          onClick={(e) => {
            e.preventDefault();
            goBackOr(navigate, back);
          }}
          className="press -ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-chalk-2 hover:bg-iron-2"
        >
          <Icon name="chevronLeft" size={22} />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-h2 font-semibold">{title}</h1>
        {sub && <p className="truncate text-sm text-chalk-3">{sub}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}

export function Section({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex min-w-0 flex-col gap-2 ${className}`}>
      {(title || action) && (
        <div className="flex min-h-8 items-center justify-between gap-2 px-1">
          {title && <h2 className="label">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: Parameters<typeof Icon>[0]['name']; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-seam-strong px-6 py-8 text-center">
      {icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-iron-2 text-chalk-3">
          <Icon name={icon} size={22} />
        </span>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-h4 font-medium">{title}</p>
        {body && <p className="text-base text-chalk-3">{body}</p>}
      </div>
      {action}
    </div>
  );
}

/** 進度條：細線、圓頭；超過目標時以文字提示，不用變色嚇人 */
export function Meter({ value, max, color = 'var(--chalk)', label, height = 6 }: { value: number; max: number; color?: string; label?: string; height?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(value)}
      className="w-full overflow-hidden rounded-full bg-iron-3"
      style={{ height }}
    >
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function ListRow({
  children,
  onClick,
  to,
  trailing,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  to?: string;
  trailing?: ReactNode;
  className?: string;
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">{children}</div>
      {trailing ?? ((to || onClick) && <Icon name="chevronRight" size={18} className="shrink-0 text-chalk-3" />)}
    </>
  );
  const cls = `press flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left ${to || onClick ? 'hover:bg-iron-2' : ''} ${className}`;
  if (to)
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  return <div className={cls}>{inner}</div>;
}
