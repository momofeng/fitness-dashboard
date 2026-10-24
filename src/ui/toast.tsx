import { useSyncExternalStore } from 'react';
import { Icon } from './Icon';

// 全域提示（含「復原」）。一次只顯示一則，新的取代舊的。

interface ToastState {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone: 'default' | 'error';
}

let current: ToastState | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(message: string, opts: { actionLabel?: string; onAction?: () => void; tone?: 'default' | 'error'; ms?: number } = {}) {
  current = { id: ++seq, message, actionLabel: opts.actionLabel, onAction: opts.onAction, tone: opts.tone ?? 'default' };
  if (timer) clearTimeout(timer);
  timer = setTimeout(dismiss, opts.ms ?? (opts.onAction ? 6000 : 3000));
  emit();
}

/** 刪除後可復原 */
export function toastUndo(message: string, undo: () => unknown) {
  toast(message, { actionLabel: '復原', onAction: () => void undo() });
}

export function dismiss() {
  current = null;
  emit();
}

export function Toaster() {
  const t = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  if (!t) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-6">
      <div
        key={t.id}
        role="status"
        aria-live="polite"
        className={`fade-enter pointer-events-auto flex max-w-md min-w-0 items-center gap-3 rounded-lg border border-seam-strong py-2 pr-2 pl-4 shadow-lg ${
          t.tone === 'error' ? 'bg-danger-soft text-danger' : 'bg-iron-3 text-chalk'
        }`}
        style={{ backdropFilter: 'blur(8px)' }}
      >
        {t.tone === 'error' && <Icon name="info" size={18} />}
        <span className="min-w-0 flex-1 text-base">{t.message}</span>
        {t.actionLabel && (
          <button
            type="button"
            className="press h-9 shrink-0 rounded-sm px-3 font-semibold text-chalk hover:bg-iron-2"
            onClick={() => {
              t.onAction?.();
              dismiss();
            }}
          >
            {t.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
