// No recovery key or plaintext records are accepted by this service.
type Row = Record<string, unknown>;
export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Row>(): Promise<T | null>;
  all<T = Row>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface VaultEnv {
  DB: { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<Array<{ meta: { changes: number } }>> };
  BUCKET: { put(key: string, data: ArrayBuffer | Uint8Array, options?: unknown): Promise<unknown>; get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>; delete(key: string): Promise<unknown> };
}
const MAX_BYTES = 8 * 1024 * 1024;
const ID = /^[A-Za-z0-9_-]{43}$/;
const ALLOWED = new Set(['https://momofeng.github.io', 'http://127.0.0.1:5173', 'http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:4173']);
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
async function hash(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}
async function readBytes(request: Request, max: number): Promise<Uint8Array> {
  if (Number(request.headers.get('content-length')) > max) throw new Error('large');
  const reader = request.body?.getReader(); if (!reader) throw new Error('empty');
  const chunks: Uint8Array[] = []; let length = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > max) { await reader.cancel(); throw new Error('large'); } chunks.push(value); }
  const bytes = new Uint8Array(length); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  return bytes;
}
function packetValid(bytes: Uint8Array) { return bytes.byteLength >= 30 && bytes[0] === 1; }
async function limited(env: VaultEnv, request: Request, category: string, max: number, periodMs: number) {
  const now = Date.now(); const window = Math.floor(now / periodMs);
  const ipHash = await hash('fitness-v1:' + (request.headers.get('cf-connecting-ip') ?? 'local') + ':' + category + ':' + window);
  const row = await env.DB.prepare('INSERT INTO rate_limits(id, hits, expires_at) VALUES (?, 1, ?) ON CONFLICT(id) DO UPDATE SET hits = hits + 1 WHERE hits < ? RETURNING hits').bind(ipHash, now + periodMs * 2, max).first();
  if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now).run();
  return row != null;
}
async function route(request: Request, env: VaultEnv): Promise<Response> {
  const url = new URL(request.url); const parts = url.pathname.replace(/^\/api/, '').split('/').filter(Boolean);
  if (url.pathname === '/api/health') return json({ service: 'fitness-encrypted-sync', protocol: 1 });
  if (parts[0] !== 'v1') return json({ error: 'not_found' }, 404);
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!ID.test(token)) return json({ error: 'unauthorized' }, 401);
  const authHash = await hash(token);
  const now = Date.now();
  if (parts[1] === 'pairings' && ID.test(parts[2] ?? '') && parts.length === 3 && request.method === 'POST') {
    if (!await limited(env, request, 'pair-claim', 20, 60000)) return json({ error: 'rate_limit' }, 429);
    const row = await env.DB.prepare('DELETE FROM pairings WHERE id = ? AND auth_hash = ? AND expires_at > ? RETURNING packet, expires_at').bind(parts[2], authHash, now).first<{ packet: string; expires_at: number }>();
    return row ? json({ packet: row.packet, expiresAt: row.expires_at }) : json({ error: 'pair_expired' }, 404);
  }
  const id = parts[2] ?? '';
  if (parts[1] !== 'vaults' || !ID.test(id)) return json({ error: 'not_found' }, 404);
  if (!await limited(env, request, 'vault-access', 180, 60000)) return json({ error: 'rate_limit' }, 429);
  const vault = await env.DB.prepare('SELECT * FROM vaults WHERE id = ? AND auth_hash = ?').bind(id, authHash).first<{ id: string; revision: number; object_key: string; updated_at: number }>();
  if (parts.length === 3 && request.method === 'POST') {
    if (!await limited(env, request, 'vault-create', 5, 3600000)) return json({ error: 'rate_limit' }, 429);
    if (vault) return json({ error: 'already_exists' }, 409);
    const bytes = await readBytes(request, MAX_BYTES); if (!packetValid(bytes)) return json({ error: 'invalid_packet' }, 400);
    const key = id + '/' + crypto.randomUUID();
    await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: 'application/octet-stream' } });
    try {
      const result = await env.DB.batch([
        env.DB.prepare('INSERT INTO vaults(id, auth_hash, revision, object_key, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?)').bind(id, authHash, key, now, now),
        env.DB.prepare('INSERT INTO revisions(vault_id, revision, object_key, created_at) VALUES (?, 1, ?, ?)').bind(id, key, now),
      ]);
      if (!result[0]?.meta.changes) throw new Error('create');
      return json({ revision: 1, updatedAt: now }, 201);
    } catch {
      // A transport error may arrive after D1 committed. Never delete an object still at the head.
      try {
        const saved = await env.DB.prepare('SELECT object_key FROM vaults WHERE id = ?').bind(id).first<{ object_key: string }>();
        if (saved?.object_key === key) return json({ revision: 1, updatedAt: now }, 201);
        await env.BUCKET.delete(key);
        return json({ error: saved ? 'already_exists' : 'unavailable' }, saved ? 409 : 503);
      } catch { return json({ error: 'unavailable' }, 503); }
    }
  }
  if (!vault) return json({ error: 'unauthorized' }, 401);
  if (parts[3] === 'pairings' && ID.test(parts[4] ?? '') && parts.length === 5 && request.method === 'POST') {
    if (!await limited(env, request, 'pair-create', 10, 60000)) return json({ error: 'rate_limit' }, 429);
    const raw = JSON.parse(new TextDecoder().decode(await readBytes(request, 10000))) as { pairAuth: string; packet: string };
    if (!raw || !ID.test(raw.pairAuth) || typeof raw.packet !== 'string' || !/^[A-Za-z0-9_-]{40,8000}$/.test(raw.packet)) return json({ error: 'invalid_pair' }, 400);
    const expiresAt = now + 300000;
    await env.DB.batch([
      env.DB.prepare('DELETE FROM pairings WHERE expires_at <= ?').bind(now),
      env.DB.prepare('INSERT INTO pairings(id, vault_id, auth_hash, packet, expires_at) VALUES (?, ?, ?, ?, ?)').bind(parts[4], id, await hash(raw.pairAuth), raw.packet, expiresAt),
    ]);
    return json({ expiresAt }, 201);
  }
  if (parts[3] === 'versions' && parts.length === 4 && request.method === 'GET') {
    const result = await env.DB.prepare('SELECT revision, created_at FROM revisions WHERE vault_id = ? ORDER BY revision DESC LIMIT 10').bind(id).all();
    return json({ versions: result.results.map((r) => ({ revision: r.revision, createdAt: r.created_at })) });
  }
  if (parts.length !== 3) return json({ error: 'not_found' }, 404);
  if (request.method === 'GET') {
    if (url.searchParams.get('meta') === '1') return json({ revision: vault.revision, updatedAt: vault.updated_at });
    let key = vault.object_key;
    const revision = url.searchParams.get('revision');
    if (revision != null) {
      if (!/^[1-9]\d{0,12}$/.test(revision)) return json({ error: 'invalid_revision' }, 400);
      const row = await env.DB.prepare('SELECT object_key FROM revisions WHERE vault_id = ? AND revision = ?').bind(id, Number(revision)).first<{ object_key: string }>();
      if (!row) return json({ error: 'not_found' }, 404); key = row.object_key;
    }
    const object = await env.BUCKET.get(key);
    if (!object) return json({ error: 'unavailable' }, 503);
    return new Response(await object.arrayBuffer(), { headers: { 'Content-Type': 'application/octet-stream', 'X-Vault-Revision': revision ?? String(vault.revision) } });
  }
  if (request.method === 'PUT') {
    const expected = Number(request.headers.get('if-match'));
    if (!Number.isSafeInteger(expected) || expected < 1 || expected !== vault.revision) return json({ error: 'revision_conflict' }, 409);
    const bytes = await readBytes(request, MAX_BYTES); if (!packetValid(bytes)) return json({ error: 'invalid_packet' }, 400);
    const key = id + '/' + crypto.randomUUID();
    await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: 'application/octet-stream' } });
    try {
      const results = await env.DB.batch([
        env.DB.prepare('INSERT INTO revisions(vault_id, revision, object_key, created_at) SELECT id, revision + 1, ?, ? FROM vaults WHERE id = ? AND auth_hash = ? AND revision = ?').bind(key, now, id, authHash, expected),
        env.DB.prepare('UPDATE vaults SET revision = revision + 1, object_key = ?, updated_at = ? WHERE id = ? AND auth_hash = ? AND revision = ? AND EXISTS (SELECT 1 FROM revisions WHERE vault_id = ? AND revision = ? AND object_key = ?)').bind(key, now, id, authHash, expected, id, expected + 1, key),
      ]);
      if (!results[0]?.meta.changes || !results[1]?.meta.changes) { await env.BUCKET.delete(key); return json({ error: 'revision_conflict' }, 409); }
    } catch {
      try {
        const saved = await env.DB.prepare('SELECT object_key, revision FROM vaults WHERE id = ? AND auth_hash = ?').bind(id, authHash).first<{ object_key: string; revision: number }>();
        if (saved?.object_key !== key || saved.revision !== expected + 1) { await env.BUCKET.delete(key); return json({ error: 'unavailable' }, 503); }
        // The write committed despite the failed acknowledgement; continue as a successful save.
      } catch { return json({ error: 'unavailable' }, 503); }
    }
    // Prune only immutable old versions; cleanup failure never invalidates a successful save.
    try {
      const old = await env.DB.prepare('SELECT object_key FROM revisions WHERE vault_id = ? AND revision <= ?').bind(id, expected + 1 - 10).all<{ object_key: string }>();
      for (const row of old.results) await env.BUCKET.delete(row.object_key);
      await env.DB.prepare('DELETE FROM revisions WHERE vault_id = ? AND revision <= ?').bind(id, expected + 1 - 10).run();
    } catch {}
    return json({ revision: expected + 1, updatedAt: now });
  }
  return json({ error: 'method_not_allowed' }, 405);
}
export async function handleVaultRequest(request: Request, env: VaultEnv): Promise<Response> {
  const origin = request.headers.get('origin');
  const sameOrigin = origin === new URL(request.url).origin;
  const allowed = !origin || ALLOWED.has(origin) || sameOrigin;
  if (!allowed) return json({ error: 'origin_not_allowed' }, 403);
  let response: Response;
  if (request.method === 'OPTIONS') response = new Response(null, { status: 204 });
  else {
    try { response = await route(request, env); }
    catch (e) { const large = e instanceof Error && e.message === 'large'; const invalid = e instanceof SyntaxError || e instanceof Error && e.message === 'empty'; response = json({ error: large ? 'too_large' : invalid ? 'invalid_request' : 'unavailable' }, large ? 413 : invalid ? 400 : 503); }
  }
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Vary', 'Origin');
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-Match');
    response.headers.set('Access-Control-Expose-Headers', 'X-Vault-Revision');
  }
  return response;
}
