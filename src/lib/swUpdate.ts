// Service worker 更新：registerType 'prompt'，有新版時先提示，不自動重新載入，避免組間被打斷。

import { useSyncExternalStore } from 'react';

let needRefresh = false;
let offlineReady = false;
let updater: ((reload?: boolean) => Promise<void>) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function initServiceWorker() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  const { registerSW } = await import('virtual:pwa-register');
  updater = registerSW({
    onNeedRefresh() {
      needRefresh = true;
      emit();
    },
    onOfflineReady() {
      offlineReady = true;
      emit();
    },
  });
}

export function applyUpdate() {
  void updater?.(true);
}

export function dismissUpdate() {
  needRefresh = false;
  emit();
}

export function useSwState() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (needRefresh ? 'update' : offlineReady ? 'ready' : 'idle'),
  );
}
