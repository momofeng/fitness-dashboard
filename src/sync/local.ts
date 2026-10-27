import Dexie, { type EntityTable } from 'dexie';
import type { BackupFile } from '../db/backup/backup';
export const SYNC_CREDENTIAL_KEY = 'fd:sync:credential';
export interface SyncCredential { recoveryKey: string; endpoint: string; vaultId: string }
interface BaseState { id: string; data: BackupFile; revision: number; lastSuccessAt?: number }
class SyncPrivateDB extends Dexie {
  bases!: EntityTable<BaseState, 'id'>;
  constructor() { super('momofeng-fitness-sync-private'); this.version(1).stores({ bases: 'id' }); }
}
export const syncPrivateDb = new SyncPrivateDB();
export function getSyncCredential(): SyncCredential | null {
  try { const raw = localStorage.getItem(SYNC_CREDENTIAL_KEY); if (!raw) return null; const value = JSON.parse(raw) as SyncCredential; return typeof value?.recoveryKey === 'string' && typeof value.endpoint === 'string' && typeof value.vaultId === 'string' ? value : null; } catch { return null; }
}
export function hasSyncCredential(): boolean { try { return localStorage.getItem(SYNC_CREDENTIAL_KEY) != null; } catch { return false; } }
export function setSyncCredential(value: SyncCredential | null) {
  if (value) localStorage.setItem(SYNC_CREDENTIAL_KEY, JSON.stringify(value)); else localStorage.removeItem(SYNC_CREDENTIAL_KEY);
  window.dispatchEvent(new Event('fitness-sync-credential'));
}
export function baseId(credential: SyncCredential) { return credential.endpoint + '/' + credential.vaultId; }
export async function clearSyncPrivateData() {
  setSyncCredential(null);
  await syncPrivateDb.bases.clear();
}
