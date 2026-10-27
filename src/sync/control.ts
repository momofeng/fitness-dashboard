export const SYNC_EPOCH_KEY = 'fd:sync:epoch';
export function syncEpoch(): string { return localStorage.getItem(SYNC_EPOCH_KEY) ?? 'initial'; }
export function invalidateSyncEpoch() { localStorage.setItem(SYNC_EPOCH_KEY, crypto.randomUUID()); }
export function assertEpoch(expected: string) { if (syncEpoch() !== expected) throw new Error('同步操作已取消，本機資料沒有被還原'); }
export async function setupOperation<T>(work: (guard: () => void) => Promise<T>) {
  const epoch = syncEpoch();
  if (!navigator.locks) throw new Error('請使用支援多分頁安全同步的新版 Chrome');
  return navigator.locks.request('fitness-sync:setup', async () => { const guard = () => assertEpoch(epoch); guard(); return work(guard); });
}
