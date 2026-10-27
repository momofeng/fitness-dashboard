import Dexie from 'dexie';
import { syncEpoch, assertEpoch, invalidateSyncEpoch, setupOperation } from './control';
import { db, DB_NAME } from '../db/db';
import { exportBackup, backupFileName, type BackupFile } from '../db/backup/backup';
import { mergeSyncTables, type SyncConflict } from '../core/syncMerge';
import { download } from '../lib/platform';
import { api, readPacket, SyncHttpError } from './api';
import { deriveVault, newRecoveryKey, decryptPacket, encryptPacket, newPairing, derivePairing, encode64, decode64 } from './crypto';
import { normalizeEndpoint } from './config';
import { baseId, getSyncCredential, setSyncCredential, syncPrivateDb, clearSyncPrivateData, type SyncCredential } from './local';
import { SYNC_TABLES, SYNC_SPECS, captureSnapshot, validateSnapshot, snapshotSignature, asSyncTables, mergedSnapshot, applySyncSnapshot } from './snapshot';
import { getSyncStatus, setSyncStatus } from './status';

const purpose = (id: string, revision: number) => 'vault/' + id + '/revision/' + revision;
type Derived = Awaited<ReturnType<typeof deriveVault>>;
let stop: (() => void) | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let attempts = 0;
let generation = 0;
let pending: { local: string; revision: number; conflicts: SyncConflict[] } | undefined;
const sameCredential = (a: SyncCredential, b: SyncCredential | null) => !!b && a.endpoint === b.endpoint && a.vaultId === b.vaultId && a.recoveryKey === b.recoveryKey;
function assertCurrent(c: SyncCredential, start: number, epoch: string) { assertEpoch(epoch); if (start !== generation || !sameCredential(c, getSyncCredential())) throw new Error('同步設定已變更'); }
function schedule(ms = 1800, markPending = true) {
  if (timer) clearTimeout(timer);
  if (!getSyncCredential()) return;
  if (!pending && markPending) setSyncStatus({ phase: navigator.onLine ? 'pending' : 'offline', error: undefined });
  timer = setTimeout(() => { timer = undefined; void syncNow(); }, ms);
}
async function withVaultLock<T>(credential: SyncCredential, work: () => Promise<T>): Promise<T | undefined> {
  if (!navigator.locks) throw new Error('此瀏覽器不支援安全的多分頁同步，請改用新版 Chrome');
  return navigator.locks.request('fitness-sync:' + baseId(credential), { ifAvailable: true }, async (lock) => {
    if (!lock) throw new Error('另一個分頁正在同步，請稍後再試');
    return work();
  });
}
async function remoteSnapshot(c: SyncCredential, d: Derived, revision?: number) {
  const response = await api(c.endpoint, 'vaults/' + d.vaultId + (revision ? '?revision=' + revision : ''), d.authToken);
  const version = Number(response.headers.get('X-Vault-Revision'));
  if (!Number.isSafeInteger(version) || version < 1 || revision != null && version !== revision) throw new Error('雲端版本資訊不正確');
  const value = await decryptPacket(await readPacket(response), d.encryptionKey, purpose(d.vaultId, version));
  if (!value || typeof value !== 'object' || (value as { protocol?: unknown }).protocol !== 1 || !('snapshot' in value)) throw new Error('無法讀取這個同步版本');
  return { data: await validateSnapshot(value.snapshot), revision: version };
}
async function encryptedSnapshot(snapshot: BackupFile, d: Derived, revision: number) {
  return encryptPacket({ protocol: 1, snapshot }, d.encryptionKey, purpose(d.vaultId, revision));
}
export async function createSyncSpace(endpointValue: string): Promise<string> {
  return setupOperation(async (guard) => {
  if (!(await db.settings.get('app'))?.onboarded) throw new Error('請先完成基本設定');
  if (getSyncCredential()) throw new Error('請先停止目前的同步空間');
  const endpoint = normalizeEndpoint(endpointValue), recoveryKey = newRecoveryKey();
  const d = await deriveVault(recoveryKey, endpoint); const snapshot = await captureSnapshot();
  await validateSnapshot(snapshot);
  const bytes = await encryptedSnapshot(snapshot, d, 1);
  const result = await api(endpoint, 'vaults/' + d.vaultId, d.authToken, { method: 'POST', body: bytes, headers: { 'Content-Type': 'application/octet-stream' } });
  guard();
  const meta = await result.json() as { revision: number };
  if (meta.revision !== 1) throw new Error('同步服務回應異常');
  const credential = { endpoint, recoveryKey, vaultId: d.vaultId };
  await syncPrivateDb.bases.put({ id: baseId(credential), data: snapshot, revision: 1, lastSuccessAt: Date.now() });
  guard();
  setSyncCredential(credential);
  setSyncStatus({ phase: 'synced', lastSuccessAt: Date.now(), revision: 1, conflicts: undefined, error: undefined });
  return recoveryKey;
  });
}
export async function inspectSyncSpace(recoveryKey: string, endpointValue: string) {
  const endpoint = normalizeEndpoint(endpointValue), d = await deriveVault(recoveryKey, endpoint);
  const credential = { endpoint, recoveryKey: d.recoveryKey, vaultId: d.vaultId };
  const remote = await remoteSnapshot(credential, d);
  return { credential, ...remote };
}
export async function joinSyncSpace(credential: SyncCredential) {
  return setupOperation(async (guard) => {
  if (getSyncCredential()) throw new Error('請先停止目前的同步空間');
  const current = await captureSnapshot();
  const records = SYNC_TABLES.filter((t) => t !== 'settings').reduce((n, t) => n + current.tables[t].length, 0);
  if (records) {
    const backup = await exportBackup(db, typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'test');
    download(new Blob([JSON.stringify(backup)], { type: 'application/json' }), backupFileName().replace('fitness-backup', 'fitness-before-sync'));
  }
  const empty = { ...current, tables: Object.fromEntries(Object.keys(current.tables).map((t) => [t, []])) as unknown as BackupFile['tables'] };
  await syncPrivateDb.bases.put({ id: baseId(credential), data: empty, revision: 0 });
  guard();
  setSyncCredential(credential);
  pending = undefined; await syncNow();
  });
}
export async function syncNow(choices: Record<string, 'local' | 'remote'> = {}) {
  if (running) { if (Object.keys(choices).length) throw new Error('同步仍在確認資料，請稍後再按確認'); schedule(2000); return; }
  const c = getSyncCredential(); if (!c) { setSyncStatus({ phase: 'off' }); return; }
  if (!navigator.onLine) { setSyncStatus({ phase: 'offline' }); return; }
  running = true; const started = generation; const epoch = syncEpoch();
  try {
    await withVaultLock(c, async () => {
      const d = await deriveVault(c.recoveryKey, c.endpoint);
      if (d.vaultId !== c.vaultId) throw new Error('同步設定中的金鑰不正確');
      const base = await syncPrivateDb.bases.get(baseId(c));
      if (!base) throw new Error('本機同步基準不存在，請重新加入此空間');
      setSyncStatus({ phase: 'syncing', error: undefined });
      const local = await captureSnapshot();
      const meta = await (await api(c.endpoint, 'vaults/' + c.vaultId + '?meta=1', d.authToken)).json() as { revision: number };
      if (!Number.isSafeInteger(meta.revision) || meta.revision < Math.max(1, base.revision)) throw new Error('雲端版本早於本機已同步版本，已停止同步以保留紀錄');
      assertCurrent(c, started, epoch);
      const remote = meta.revision === base.revision ? { data: base.data, revision: base.revision } : await remoteSnapshot(c, d);
      if (remote.revision < meta.revision) throw new Error('雲端版本資訊不一致，已停止同步以保留紀錄');
      const mergeLocal = base.revision === 0 && !(await db.settings.get('app'))?.onboarded ? { ...asSyncTables(local), settings: [] } : asSyncTables(local);
      if (pending && (pending.local !== snapshotSignature(local) || pending.revision !== remote.revision)) choices = {};
      const merged = mergeSyncTables(asSyncTables(base.data), mergeLocal, asSyncTables(remote.data), SYNC_SPECS, choices);
      if (merged.conflicts.length) {
        pending = { local: snapshotSignature(local), revision: remote.revision, conflicts: merged.conflicts };
        setSyncStatus({ phase: 'conflict', conflicts: merged.conflicts, revision: remote.revision }); return;
      }
      pending = undefined;
      const candidate = await validateSnapshot(mergedSnapshot(local, merged.tables));
      assertCurrent(c, started, epoch);
      if (snapshotSignature(candidate) !== snapshotSignature(local)) await applySyncSnapshot(candidate, local, db, () => assertCurrent(c, started, epoch));
      // Save the remote base only after the local merge committed. Offline edits now remain a delta against it.
      assertCurrent(c, started, epoch);
      await syncPrivateDb.bases.put({ id: baseId(c), data: remote.data, revision: remote.revision, lastSuccessAt: base.lastSuccessAt });
      let version = remote.revision;
      if (snapshotSignature(candidate) !== snapshotSignature(remote.data)) {
        const bytes = await encryptedSnapshot(candidate, d, remote.revision + 1);
        assertCurrent(c, started, epoch);
        const response = await api(c.endpoint, 'vaults/' + c.vaultId, d.authToken, { method: 'PUT', body: bytes, headers: { 'If-Match': String(remote.revision), 'Content-Type': 'application/octet-stream' } });
        const result = await response.json() as { revision: number };
        if (result.revision !== remote.revision + 1) throw new Error('同步服務版本資訊不正確');
        version = result.revision;
      }
      assertCurrent(c, started, epoch);
      const now = Date.now();
      await syncPrivateDb.bases.put({ id: baseId(c), data: candidate, revision: version, lastSuccessAt: now });
      assertCurrent(c, started, epoch);
      attempts = 0; setSyncStatus({ phase: 'synced', lastSuccessAt: now, revision: version, conflicts: undefined, error: undefined });
    });
  } catch (e) {
    if (started !== generation || !sameCredential(c, getSyncCredential())) return;
    const retry = e instanceof SyncHttpError && e.status === 409;
    setSyncStatus({ phase: retry ? 'pending' : 'error', error: retry ? undefined : e instanceof Error ? e.message : '同步失敗，紀錄仍在本機' });
    attempts++; schedule(Math.min(60000, retry ? 1000 : 5000 * 2 ** Math.min(attempts - 1, 4)), false);
  } finally { running = false; }
}
export async function resolveSyncConflicts(choices: Record<string, 'local' | 'remote'>) {
  if (!pending || pending.conflicts.some((c) => !choices[c.id])) throw new Error('請為每項衝突選擇保留來源');
  const current = await exportBackup(db, typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'test');
  download(new Blob([JSON.stringify(current)], { type: 'application/json' }), backupFileName().replace('fitness-backup', 'fitness-before-resolve'));
  await syncNow(choices);
}
export async function makePairingCode() {
  const c = getSyncCredential(); if (!c) throw new Error('請先啟用同步');
  const d = await deriveVault(c.recoveryKey, c.endpoint), pair = await newPairing();
  const packet = await encryptPacket({ recoveryKey: c.recoveryKey, endpoint: c.endpoint }, pair.encryptionKey, 'pairing/' + pair.id);
  const response = await api(c.endpoint, 'vaults/' + c.vaultId + '/pairings/' + pair.id, d.authToken, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pairAuth: pair.authToken, packet: encode64(packet) }) });
  const { expiresAt } = await response.json() as { expiresAt: number };
  return { code: pair.code, expiresAt };
}
export async function claimPairingCode(code: string, endpointValue: string) {
  const endpoint = normalizeEndpoint(endpointValue), pair = await derivePairing(code);
  const response = await api(endpoint, 'pairings/' + pair.id, pair.authToken, { method: 'POST' });
  const { packet } = await response.json() as { packet: string };
  if (typeof packet !== 'string' || packet.length > 8000) throw new Error('配對資料格式不正確');
  const raw = await decryptPacket(decode64(packet), pair.encryptionKey, 'pairing/' + pair.id);
  if (!raw || typeof raw !== 'object' || !('recoveryKey' in raw) || typeof raw.recoveryKey !== 'string' || !('endpoint' in raw) || normalizeEndpoint(String(raw.endpoint)) !== endpoint) throw new Error('配對服務位址不符，已停止加入');
  return inspectSyncSpace(raw.recoveryKey, endpoint);
}
export async function listSyncVersions() {
  const c = getSyncCredential(); if (!c) return [];
  const d = await deriveVault(c.recoveryKey, c.endpoint);
  return (await (await api(c.endpoint, 'vaults/' + c.vaultId + '/versions', d.authToken)).json() as { versions: Array<{ revision: number; createdAt: number }> }).versions;
}
export async function inspectSyncVersion(revision: number) {
  const c = getSyncCredential(); if (!c) throw new Error('尚未啟用同步');
  return remoteSnapshot(c, await deriveVault(c.recoveryKey, c.endpoint), revision);
}
export async function restoreSyncVersion(revision: number) {
  const c = getSyncCredential(); if (!c) throw new Error('尚未啟用同步');
  const started = generation, epoch = syncEpoch();
  await withVaultLock(c, async () => {
    const guard = () => assertCurrent(c, started, epoch);
    const d = await deriveVault(c.recoveryKey, c.endpoint);
    const old = await remoteSnapshot(c, d, revision);
    guard();
    const current = await captureSnapshot();
    const base = await syncPrivateDb.bases.get(baseId(c));
    const latest = await remoteSnapshot(c, d);
    if (latest.revision < Math.max(base?.revision ?? 1, old.revision)) throw new Error('雲端版本早於已知版本，已停止還原');
    guard();
    download(new Blob([JSON.stringify(await exportBackup(db, typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'test'))], { type: 'application/json' }), backupFileName().replace('fitness-backup', 'fitness-before-cloud-restore'));
    await applySyncSnapshot(old.data, current, db, guard);
    guard();
    await syncPrivateDb.bases.put({ id: baseId(c), data: latest.data, revision: latest.revision, lastSuccessAt: base?.lastSuccessAt });
    const packet = await encryptedSnapshot(old.data, d, latest.revision + 1);
    guard();
    const response = await api(c.endpoint, 'vaults/' + c.vaultId, d.authToken, { method: 'PUT', body: packet, headers: { 'If-Match': String(latest.revision), 'Content-Type': 'application/octet-stream' } });
    const result = await response.json() as { revision: number };
    if (!Number.isSafeInteger(result.revision) || result.revision !== latest.revision + 1) throw new Error('同步服務版本資訊不正確');
    guard();
    await syncPrivateDb.bases.put({ id: baseId(c), data: old.data, revision: result.revision, lastSuccessAt: Date.now() });
    guard();
    pending = undefined; attempts = 0;
    setSyncStatus({ phase: 'synced', lastSuccessAt: Date.now(), revision: result.revision, conflicts: undefined, error: undefined });
  });
}
export async function withSyncStopped<T>(action: () => Promise<T>): Promise<T> {
  const original = getSyncCredential();
  invalidateSyncEpoch(); generation++; pending = undefined;
  stop?.(); stop = undefined;
  if (timer) clearTimeout(timer); timer = undefined;
  setSyncCredential(null);
  setSyncStatus({ phase: 'off', conflicts: undefined, error: undefined, revision: undefined, lastSuccessAt: undefined });
  const reset = async () => {
    const last = getSyncCredential();
    setSyncCredential(null);
    const credentials = [original, last].filter((c): c is SyncCredential => c != null);
    const keys = [...new Set(credentials.map((c) => 'fitness-sync:' + baseId(c)))].sort();
    const perform = async (index: number): Promise<T> => {
      if (index < keys.length && navigator.locks) return navigator.locks.request(keys[index]!, () => perform(index + 1));
      await clearSyncPrivateData();
      return action();
    };
    return perform(0);
  };
  return navigator.locks ? navigator.locks.request('fitness-sync:setup', reset) : reset();
}
export async function disconnectSync() { return withSyncStopped(async () => undefined); }
export function startSyncEngine() {
  stop?.();
  const credential = getSyncCredential();
  if (!credential) { setSyncStatus({ phase: 'off' }); return; }
  const epoch = syncEpoch();
  void syncPrivateDb.bases.get(baseId(credential)).then((base) => {
    if (base?.lastSuccessAt && syncEpoch() === epoch && sameCredential(credential, getSyncCredential()) && !getSyncStatus().lastSuccessAt) setSyncStatus({ lastSuccessAt: base.lastSuccessAt });
  }).catch(() => undefined);
  const mutation = (parts: Record<string, unknown>) => { if (Object.keys(parts).some((p) => p.startsWith('idb://' + DB_NAME + '/'))) schedule(); };
  const resume = () => { if (document.visibilityState === 'visible') schedule(100); };
  const network = () => schedule(100);
  Dexie.on('storagemutated', mutation); window.addEventListener('online', network); document.addEventListener('visibilitychange', resume);
  const poll = setInterval(() => { if (document.visibilityState === 'visible' && !running && !pending) void syncNow(); }, 30000);
  stop = () => { Dexie.on('storagemutated').unsubscribe(mutation); window.removeEventListener('online', network); document.removeEventListener('visibilitychange', resume); clearInterval(poll); };
  schedule(100);
}
