// Loopback-only test harness: exercises the production request handler and migration SQL.
// SQLite / object map replace Cloudflare bindings. Nothing persists or reaches a cloud service.
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { handleVaultRequest, type Statement, type VaultEnv } from '../../sync-service/server/vault.ts';
const sql = new DatabaseSync(':memory:');
sql.exec(readFileSync(new URL('../../sync-service/drizzle/0000_charming_dust.sql', import.meta.url), 'utf8'));
class Query implements Statement {
  query: string; args: Array<string | number | null> = [];
  constructor(query: string) { this.query = query; }
  bind(...values: unknown[]) { this.args = values as typeof this.args; return this; }
  async first<T>() { return (sql.prepare(this.query).get(...this.args) ?? null) as T | null; }
  async all<T>() { return { results: sql.prepare(this.query).all(...this.args) as T[] }; }
  execute() { const result = sql.prepare(this.query).run(...this.args); return { meta: { changes: Number(result.changes) } }; }
  async run() { return this.execute(); }
}
const objects = new Map<string, Uint8Array>();
const env: VaultEnv = {
  DB: { prepare: (query) => new Query(query), batch: async (statements) => {
    sql.exec('BEGIN'); try { const results = statements.map((s) => (s as Query).execute()); sql.exec('COMMIT'); return results; }
    catch (e) { sql.exec('ROLLBACK'); throw e; }
  } },
  BUCKET: {
    put: async (key, value) => { objects.set(key, new Uint8Array(value instanceof ArrayBuffer ? value : value.slice())); },
    get: async (key) => { const value = objects.get(key); return value ? { arrayBuffer: async () => value.slice().buffer as ArrayBuffer } : null; },
    delete: async (key) => { objects.delete(key); },
  },
};
const server = createServer(async (req, res) => {
  try {
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 9 * 1024 * 1024) { res.writeHead(413).end(); return; } chunks.push(chunk); }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(',') : value);
    // Isolate rate buckets per test vault; actual rate limiting itself is covered by unit tests.
    headers.set('cf-connecting-ip', createHash('sha256').update(headers.get('authorization') ?? 'health').digest('hex'));
    const body = chunks.length ? new Uint8Array(Buffer.concat(chunks)) : undefined;
    const response = await handleVaultRequest(new Request('http://127.0.0.1:8789' + req.url, { method: req.method, headers, body }), env);
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500).end(); }
});
server.listen(8789, '127.0.0.1', () => process.stdout.write('Local sync test service ready on 8789\n'));
process.on('SIGTERM', () => server.close(() => { sql.close(); process.exit(0); }));
