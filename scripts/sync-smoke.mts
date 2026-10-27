// Actual local Worker + D1 + R2 smoke check. Refuses remote endpoints.
import assert from 'node:assert/strict';
import { deriveVault, newRecoveryKey, encryptPacket, decryptPacket, newPairing, encode64 } from '../src/sync/crypto.ts';
const endpoint = process.argv[2] ?? 'http://127.0.0.1:8788/api';
const url = new URL(endpoint);
assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Smoke checks only use a local service');
const d = await deriveVault(newRecoveryKey(), endpoint);
const path = endpoint + '/v1/vaults/' + d.vaultId;
const purpose = (revision: number) => 'vault/' + d.vaultId + '/revision/' + revision;
async function request(url: string, method: string, token: string, body?: BodyInit, extra: Record<string, string> = {}) {
  return fetch(url, { method, body, headers: { Authorization: 'Bearer ' + token, Origin: 'https://momofeng.github.io', ...extra }, signal: AbortSignal.timeout(15000) });
}
assert.equal((await fetch(endpoint + '/health')).status, 200);
const first = await encryptPacket({ smoke: '本機加密往返', version: 1 }, d.encryptionKey, purpose(1));
assert.equal((await request(path, 'POST', d.authToken, first)).status, 201);
const read = await request(path, 'GET', d.authToken);
assert.equal(read.headers.get('X-Vault-Revision'), '1');
assert.deepEqual(await decryptPacket(new Uint8Array(await read.arrayBuffer()), d.encryptionKey, purpose(1)), { smoke: '本機加密往返', version: 1 });
const second = await encryptPacket({ version: 2 }, d.encryptionKey, purpose(2));
assert.equal((await request(path, 'PUT', d.authToken, second, { 'If-Match': '1' })).status, 200);
assert.equal((await request(path, 'PUT', d.authToken, second, { 'If-Match': '1' })).status, 409);
for (let pairing = 0; pairing < 5; pairing++) {
const pair = await newPairing();
const packet = encode64(await encryptPacket({ recoveryKey: d.recoveryKey, endpoint }, pair.encryptionKey, 'pairing/' + pair.id));
assert.equal((await request(path + '/pairings/' + pair.id, 'POST', d.authToken, JSON.stringify({ pairAuth: pair.authToken, packet }), { 'Content-Type': 'application/json' })).status, 201);
const claim = endpoint + '/v1/pairings/' + pair.id;
const claimed = await request(claim, 'POST', pair.authToken);
assert.equal(claimed.status, 200, claimed.ok ? '' : await claimed.text());
assert.equal((await request(claim, 'POST', pair.authToken)).status, 404);
}
console.log('Local Worker / D1 / R2: encrypted round trip, CAS, single-use pairing passed.');
