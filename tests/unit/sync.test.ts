import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { deriveVault, newRecoveryKey, encryptPacket, decryptPacket, newPairing, encode64 } from '../../src/sync/crypto';
import { mergeSyncTables } from '../../src/core/syncMerge';
import { handleVaultRequest, type VaultEnv, type Statement } from '../../sync-service/server/vault';
import { db } from '../../src/db/db';
import { defaultSettings } from '../../src/db/defaults';
import { captureSnapshot, applySyncSnapshot, validateSnapshot } from '../../src/sync/snapshot';

const endpoint = 'https://vault.test/api';
const purpose = (id: string, rev: number) => 'vault/' + id + '/revision/' + rev;
class MemoryStatement implements Statement {
  args: unknown[] = [];
  database: DatabaseSync; sql: string;
  constructor(database: DatabaseSync, sql: string) { this.database = database; this.sql = sql; }
  bind(...args: unknown[]) { this.args = args; return this; }
  async first<T>() { return (this.database.prepare(this.sql).get(...this.args as Array<string | number | null>) ?? null) as T | null; }
  async all<T>() { return { results: this.database.prepare(this.sql).all(...this.args as Array<string | number | null>) as T[] }; }
  execute() { const result = this.database.prepare(this.sql).run(...this.args as Array<string | number | null>); return { meta: { changes: Number(result.changes) } }; }
  async run() { return this.execute(); }
}
function service() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../../sync-service/drizzle/0000_charming_dust.sql', import.meta.url), 'utf8'));
  const objects = new Map<string, Uint8Array>(); let failWrite = false; let failBatch = false; let lostAck = false;
  const env: VaultEnv = {
    DB: { prepare: (text) => new MemoryStatement(sql, text), batch: async (statements) => { if (failBatch) throw new Error('database unavailable'); sql.exec('BEGIN'); try { const out = statements.map((s) => (s as MemoryStatement).execute()); sql.exec('COMMIT'); if (lostAck) throw new Error('lost acknowledgement'); return out; } catch (e) { if (!lostAck) sql.exec('ROLLBACK'); throw e; } } },
    BUCKET: { put: async (key, value) => { if (failWrite) throw new Error('storage unavailable'); objects.set(key, new Uint8Array(value instanceof ArrayBuffer ? value : value.slice())); },
      get: async (key) => { const bytes = objects.get(key); return bytes ? { arrayBuffer: async () => bytes.slice().buffer as ArrayBuffer } : null; }, delete: async (key) => { objects.delete(key); } },
  };
  const request = async (path: string, token: string, method = 'GET', body?: BodyInit, headers: Record<string, string> = {}) =>
    handleVaultRequest(new Request(endpoint + '/v1/' + path, { method, body, headers: { Authorization: 'Bearer ' + token, Origin: 'https://momofeng.github.io', ...headers } }), env);
  return { sql, objects, request, failWrite: (value: boolean) => failWrite = value, failBatch: (value: boolean) => failBatch = value, loseAcknowledgement: (value: boolean) => lostAck = value };
}

describe('恢復金鑰與認證加密', () => {
  it('金鑰格式、HKDF 用途與服務位址分離', async () => {
    const code = newRecoveryKey(); const a = await deriveVault(code, endpoint); const b = await deriveVault(code, 'https://other.test/api');
    expect(code).toMatch(/^FIT1\.[A-Za-z0-9_-]{43}$/); expect(a.vaultId).not.toBe(a.authToken);
    expect(a.authToken).not.toBe(b.authToken); expect(a.vaultId).not.toBe(b.vaultId);
    await expect(deriveVault('123456', endpoint)).rejects.toThrow();
  });
  it('每次使用新 IV；改密文、nonce、用途、版本、金鑰都拒絕', async () => {
    const d = await deriveVault(newRecoveryKey(), endpoint); const value = { note: '深蹲 60 公斤', rows: [1, 2, 3] };
    const a = await encryptPacket(value, d.encryptionKey, purpose(d.vaultId, 1)); const b = await encryptPacket(value, d.encryptionKey, purpose(d.vaultId, 1));
    expect(encode64(a.slice(1, 13))).not.toBe(encode64(b.slice(1, 13)));
    expect(await decryptPacket(a, d.encryptionKey, purpose(d.vaultId, 1))).toEqual(value);
    expect(new TextDecoder().decode(a)).not.toContain('深蹲');
    const wrong = await deriveVault(newRecoveryKey(), endpoint);
    for (const index of [1, 13, a.length - 1]) { const changed = a.slice(); changed[index] = changed[index]! ^ 1; await expect(decryptPacket(changed, d.encryptionKey, purpose(d.vaultId, 1))).rejects.toThrow(); }
    await expect(decryptPacket(a, d.encryptionKey, purpose(d.vaultId, 2))).rejects.toThrow();
    await expect(decryptPacket(a, d.encryptionKey, purpose('other', 1))).rejects.toThrow();
    await expect(decryptPacket(a, wrong.encryptionKey, purpose(d.vaultId, 1))).rejects.toThrow();
  });
});

describe('三方合併與刪除', () => {
  const specs = { rows: { key: 'id', stamp: 'updatedAt' } };
  it('不同筆合併；刪除不復活；同筆修改保留衝突', () => {
    const base = { rows: [{ id: 'a', reps: 10, updatedAt: 1 }, { id: 'delete', reps: 1 }] };
    const local = { rows: [{ id: 'a', reps: 12, updatedAt: 2 }, { id: 'new-local', reps: 5 }] };
    const remote = { rows: [{ id: 'a', reps: 11, updatedAt: 3 }, { id: 'delete', reps: 1 }, { id: 'new-remote', reps: 6 }] };
    const result = mergeSyncTables(base, local, remote, specs);
    expect(result.conflicts).toHaveLength(1); expect(result.tables.rows!.map((r) => r.id)).not.toContain('delete');
    const resolved = mergeSyncTables(base, local, remote, specs, { 'rows:a': 'local' });
    expect(resolved.tables.rows!.find((r) => r.id === 'a')?.reps).toBe(12);
    expect(resolved.tables.rows).toHaveLength(3);
  });
  it('只有時間戳不同時採雲端，避免兩台裝置無限互推', () => {
    const local = { rows: [{ id: 'a', reps: 10, updatedAt: 3 }] }, remote = { rows: [{ id: 'a', reps: 10, updatedAt: 5 }] };
    const result = mergeSyncTables(local, local, remote, specs);
    expect(result.tables).toEqual(remote); expect(result.conflicts).toEqual([]);
  });
  it('刪場次與新增組數衝突，選擇後仍維持父子關聯', () => {
    const s = { workouts: { key: 'id', stamp: 'updatedAt' }, sets: { key: 'id', stamp: 'updatedAt' } };
    const base = { workouts: [{ id: 'w' }], sets: [] }, local = { workouts: [{ id: 'w' }], sets: [{ id: 's', workoutId: 'w' }] }, remote = { workouts: [], sets: [] };
    const result = mergeSyncTables(base, local, remote, s);
    expect(result.conflicts[0]?.id).toBe('workouts:reference:w');
    const kept = mergeSyncTables(base, local, remote, s, { 'workouts:reference:w': 'local' });
    expect(kept.tables.workouts).toHaveLength(1); expect(kept.tables.sets).toHaveLength(1);
    const removed = mergeSyncTables(base, local, remote, s, { 'workouts:reference:w': 'remote' });
    expect(removed.tables.sets).toHaveLength(0);
  });
  it('補給品與習慣的刪除／新增打卡同樣要求確認', () => {
    for (const [parent, child, foreign] of [['products', 'supplementLogs', 'productId'], ['habits', 'habitLogs', 'habitId']]) {
      const specs = { [parent!]: { key: 'id', stamp: 'updatedAt' }, [child!]: { key: 'id', stamp: 'updatedAt' } };
      const base = { [parent!]: [{ id: 'p' }], [child!]: [] };
      const local = { [parent!]: [{ id: 'p' }], [child!]: [{ id: 'c', [foreign!]: 'p' }] }, remote = { [parent!]: [], [child!]: [] };
      const result = mergeSyncTables(base, local, remote, specs);
      expect(result.conflicts).toHaveLength(1);
      const kept = mergeSyncTables(base, local, remote, specs, { [result.conflicts[0]!.id]: 'local' });
      expect(kept.tables[parent!]).toHaveLength(1); expect(kept.tables[child!]).toHaveLength(1);
      const removed = mergeSyncTables(base, local, remote, specs, { [result.conflicts[0]!.id]: 'remote' });
      expect(removed.tables[parent!]).toHaveLength(0); expect(removed.tables[child!]).toHaveLength(0);
    }
  });
  it('兩個啟用課表必須選擇，不偷偷挑第一份', () => {
    const specs = { programs: { key: 'id', stamp: 'updatedAt' } };
    const local = { programs: [{ id: 'a', isActive: 1 }] }, remote = { programs: [{ id: 'b', isActive: 1 }] };
    expect(mergeSyncTables({}, local, remote, specs).conflicts[0]?.id).toBe('programs:active-choice');
    const result = mergeSyncTables({}, local, remote, specs, { 'programs:active-choice': 'remote' });
    expect(result.tables.programs!.filter((p) => p.isActive === 1).map((p) => p.id)).toEqual(['b']);
  });
});

describe('同步服務：授權、CAS、配對與故障', () => {
  it('並行相同版本只有一筆成功；回傳新版本密文可驗證', async () => {
    const s = service(), d = await deriveVault(newRecoveryKey(), endpoint), path = 'vaults/' + d.vaultId;
    const first = await encryptPacket({ n: 1 }, d.encryptionKey, purpose(d.vaultId, 1));
    expect((await s.request(path, d.authToken, 'POST', first)).status).toBe(201);
    const wrong = await deriveVault(newRecoveryKey(), endpoint);
    expect((await s.request(path, wrong.authToken)).status).toBe(401);
    const a = await encryptPacket({ n: 'a' }, d.encryptionKey, purpose(d.vaultId, 2)), b = await encryptPacket({ n: 'b' }, d.encryptionKey, purpose(d.vaultId, 2));
    const responses = await Promise.all([s.request(path, d.authToken, 'PUT', a, { 'If-Match': '1' }), s.request(path, d.authToken, 'PUT', b, { 'If-Match': '1' })]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const latest = await s.request(path, d.authToken); expect(latest.headers.get('X-Vault-Revision')).toBe('2');
    expect(['a', 'b']).toContain((await decryptPacket(new Uint8Array(await latest.arrayBuffer()), d.encryptionKey, purpose(d.vaultId, 2)) as { n: string }).n);
    expect(s.objects.size).toBe(2); s.sql.close();
  });
  it('儲存故障不改最新指標，錯誤回 503', async () => {
    const s = service(), d = await deriveVault(newRecoveryKey(), endpoint), path = 'vaults/' + d.vaultId;
    const first = await encryptPacket({ n: 1 }, d.encryptionKey, purpose(d.vaultId, 1)); await s.request(path, d.authToken, 'POST', first);
    s.failWrite(true); expect((await s.request(path, d.authToken, 'PUT', first, { 'If-Match': '1' })).status).toBe(503); s.failWrite(false);
    s.failBatch(true); expect((await s.request(path, d.authToken, 'PUT', first, { 'If-Match': '1' })).status).toBe(503); s.failBatch(false);
    expect((await (await s.request(path + '?meta=1', d.authToken)).json() as { revision: number }).revision).toBe(1); expect(s.objects.size).toBe(1); s.sql.close();
  });
  it('D1 已提交但回應遺失，不會刪掉正在使用的密文', async () => {
    const s = service(), d = await deriveVault(newRecoveryKey(), endpoint), path = 'vaults/' + d.vaultId;
    s.loseAcknowledgement(true);
    expect((await s.request(path, d.authToken, 'POST', await encryptPacket({ n: 1 }, d.encryptionKey, purpose(d.vaultId, 1)))).status).toBe(201);
    expect((await s.request(path, d.authToken, 'PUT', await encryptPacket({ n: 2 }, d.encryptionKey, purpose(d.vaultId, 2)), { 'If-Match': '1' })).status).toBe(200);
    const latest = await s.request(path, d.authToken);
    expect(await decryptPacket(new Uint8Array(await latest.arrayBuffer()), d.encryptionKey, purpose(d.vaultId, 2))).toEqual({ n: 2 });
    expect(s.objects.size).toBe(2); s.sql.close();
  });
  it('只保留最近10版，過期版本無法讀取，最新密文保留', async () => {
    const s = service(), d = await deriveVault(newRecoveryKey(), endpoint), path = 'vaults/' + d.vaultId;
    for (let revision = 1; revision <= 12; revision++) {
      const packet = await encryptPacket({ revision }, d.encryptionKey, purpose(d.vaultId, revision));
      expect((await s.request(path, d.authToken, revision === 1 ? 'POST' : 'PUT', packet, revision > 1 ? { 'If-Match': String(revision - 1) } : {})).status).toBe(revision === 1 ? 201 : 200);
    }
    const data = await (await s.request(path + '/versions', d.authToken)).json() as { versions: Array<{ revision: number }> };
    expect(data.versions.map((v) => v.revision)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
    expect((await s.request(path + '?revision=2', d.authToken)).status).toBe(404); expect(s.objects.size).toBe(10); s.sql.close();
  });
  it('同來源短時間大量建立空間會被限流', async () => {
    const s = service();
    for (let n = 0; n < 6; n++) {
      const d = await deriveVault(newRecoveryKey(), endpoint);
      const response = await s.request('vaults/' + d.vaultId, d.authToken, 'POST', await encryptPacket({}, d.encryptionKey, purpose(d.vaultId, 1)));
      expect(response.status).toBe(n < 5 ? 201 : 429);
    }
    expect(s.objects.size).toBe(5); s.sql.close();
  });
  it('配對授權不同於 seed；錯誤憑證不消耗，並行只能領一次，過期拒絕', async () => {
    const s = service(), d = await deriveVault(newRecoveryKey(), endpoint), path = 'vaults/' + d.vaultId;
    await s.request(path, d.authToken, 'POST', await encryptPacket({}, d.encryptionKey, purpose(d.vaultId, 1)));
    const pair = await newPairing(); expect(pair.authToken).not.toBe(pair.code.slice(6));
    const packet = encode64(await encryptPacket({ recoveryKey: d.recoveryKey }, pair.encryptionKey, 'pairing/' + pair.id));
    const created = await s.request(path + '/pairings/' + pair.id, d.authToken, 'POST', JSON.stringify({ pairAuth: pair.authToken, packet }));
    expect(created.status).toBe(201);
    expect((await s.request('pairings/' + pair.id, d.authToken, 'POST')).status).toBe(404);
    const claimed = await Promise.all([s.request('pairings/' + pair.id, pair.authToken, 'POST'), s.request('pairings/' + pair.id, pair.authToken, 'POST')]);
    expect(claimed.map((r) => r.status).sort()).toEqual([200, 404]);
    const next = await newPairing(); await s.request(path + '/pairings/' + next.id, d.authToken, 'POST', JSON.stringify({ pairAuth: next.authToken, packet }));
    s.sql.exec('UPDATE pairings SET expires_at = 0'); expect((await s.request('pairings/' + next.id, next.authToken, 'POST')).status).toBe(404); s.sql.close();
  });
  it('跨來源拒絕，預檢允許必要標頭且不快取', async () => {
    const s = service();
    const bad = await handleVaultRequest(new Request(endpoint + '/health', { headers: { Origin: 'https://evil.test' } }), sEnv(s));
    expect(bad.status).toBe(403);
    function sEnv(s: ReturnType<typeof service>) { return { DB: { prepare: (q: string) => new MemoryStatement(s.sql, q), batch: async () => [] }, BUCKET: { put: async () => undefined, get: async () => null, delete: async () => undefined } }; }
    s.sql.close();
  });
});

describe('本機原子套用與隱私排除', () => {
  beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); await db.settings.put({ ...defaultSettings(1), onboarded: true }); });
  it('進行中訓練、照片與 AI 設定不被雲端覆寫；缺表拒絕', async () => {
    const base = await captureSnapshot();
    await db.settings.update('app', { ai: { enabled: true, provider: 'gemini', model: 'mine' } });
    const now = Date.now();
    await db.workouts.put({ id: 'active', date: '2026-10-26', status: 'active', programId: null, dayId: null, dayName: '進行中', plan: [], startedAt: now, endedAt: null, restEndsAt: null, notes: '', summary: null, updatedAt: now });
    const current = await captureSnapshot(); expect(current.tables.workouts).toEqual([]); expect((current.tables.settings[0] as { ai: { enabled: boolean } }).ai.enabled).toBe(false);
    const incoming = structuredClone(base); (incoming.tables.settings[0] as { profile: { name: string } }).profile.name = '另一台更新';
    await applySyncSnapshot(incoming, current);
    expect((await db.workouts.get('active'))?.status).toBe('active'); expect((await db.settings.get('app'))?.ai.enabled).toBe(true);
    const incomplete = structuredClone(incoming) as unknown as { tables: Record<string, unknown> }; delete incomplete.tables.sets;
    await expect(validateSnapshot(incomplete)).rejects.toThrow();
  });
  it('孤兒組數或打卡在同步前拒絕，不可默默丟棄', async () => {
    const raw = await captureSnapshot();
    for (const [table, row] of [
      ['sets', { id: 's', workoutId: 'missing' }], ['supplementLogs', { id: 'p:2026-10-26', productId: 'missing' }], ['habitLogs', { id: 'h:2026-10-26', habitId: 'missing' }],
    ] as const) {
      await db.table(table).put(row);
      await expect(captureSnapshot()).rejects.toThrow(/缺少/);
      await db.table(table).clear();
    }
    const malformed = structuredClone(raw); malformed.tables.habits = [];
    malformed.tables.habitLogs = [{ id: 'missing:2026-10-26', habitId: 'missing', date: '2026-10-26', value: 1, note: '', updatedAt: 1 }];
    await expect(validateSnapshot(malformed)).rejects.toThrow();
  });
  it('同步取消 guard 在交易結尾失敗，所有表會回滾', async () => {
    const before = await captureSnapshot(), incoming = structuredClone(before);
    incoming.tables.cardio = [{ id: 'new', date: '2026-10-26', type: '快走', minutes: 20, distanceKm: null, kcal: null, note: '', updatedAt: 1 }];
    let called = 0;
    await expect(applySyncSnapshot(incoming, before, db, () => { if (++called === 3) throw new Error('cancelled'); })).rejects.toThrow('cancelled');
    expect(await captureSnapshot()).toEqual(before);
  });
  it('網路等待時本機新增資料，套用會拒絕且不清掉新紀錄', async () => {
    const captured = await captureSnapshot();
    await db.cardio.put({ id: 'new', date: '2026-10-26', type: '快走', minutes: 20, distanceKm: null, kcal: null, note: '', updatedAt: Date.now() });
    await expect(applySyncSnapshot(captured, captured)).rejects.toThrow('剛剛有變動');
    expect(await db.cardio.get('new')).toBeTruthy();
  });
});
