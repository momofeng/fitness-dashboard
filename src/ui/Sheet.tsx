import { useEffect, useRef, type ReactNode } from 'react';
import { IconButton } from './Button';

/**
 * 底部抽屜（手機）／置中對話框（桌面），用原生 <dialog>：焦點管理、Esc、Android 返回鍵都由瀏覽器處理。
 * 注意：Chromium 的 close 事件會延到下一個動畫影格才送，背景分頁可能晚到；
 * 處理器先檢查 dialog.open，避免舊的 close 事件把剛重開的抽屜關掉。
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const handle = () => {
      if (d.open) return;
      onCloseRef.current();
    };
    d.addEventListener('close', handle);
    return () => d.removeEventListener('close', handle);
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={undefined}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className={`m-0 mt-auto w-full max-w-none border-0 bg-transparent p-0 backdrop:backdrop-blur-[2px] sm:m-auto ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
    >
      {open && (
        <div className="sheet-enter flex max-h-[88dvh] flex-col rounded-t-xl border border-seam bg-iron-2 sm:rounded-xl">
          <div className="flex items-center justify-between gap-3 border-b border-seam py-2 pr-2 pl-4">
            <h2 className="min-w-0 truncate text-h4 font-semibold">{title}</h2>
            <IconButton icon="x" label="關閉" onClick={() => ref.current?.close()} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
          {footer && <div className="border-t border-seam p-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
