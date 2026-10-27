import { useEffect } from 'react';
export function SyncBootstrap() {
  useEffect(() => {
    let mounted = true;
    let initialized = false;
    const refresh = () => {
      let enabled = false; try { enabled = !!localStorage.getItem('fd:sync:credential'); } catch {}
      if (enabled || initialized) void import('./engine').then((m) => { if (mounted) m.startSyncEngine(); });
      initialized = enabled;
    };
    window.addEventListener('fitness-sync-credential', refresh);
    const stored = (e: StorageEvent) => { if (e.key === 'fd:sync:credential') refresh(); };
    window.addEventListener('storage', stored); refresh();
    return () => { mounted = false; window.removeEventListener('fitness-sync-credential', refresh); window.removeEventListener('storage', stored); };
  }, []);
  return null;
}
