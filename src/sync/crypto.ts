const encoder = new TextEncoder();
const SALT = encoder.encode('momofeng-fitness-dashboard/sync/v1');
export const MAX_PLAINTEXT = 50 * 1024 * 1024;
export const MAX_PACKET = 8 * 1024 * 1024;
export function encode64(bytes: Uint8Array): string {
  let out = ''; for (let n = 0; n < bytes.length; n += 8192) out += String.fromCharCode(...bytes.subarray(n, n + 8192));
  return btoa(out).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
export function decode64(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('金鑰或配對碼格式不正確');
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));
}
export function newRecoveryKey(): string { return 'FIT1.' + encode64(crypto.getRandomValues(new Uint8Array(32))); }
export function normalizeRecoveryKey(value: string): string {
  const key = value.replace(/\s+/g, '');
  if (!/^FIT1\.[A-Za-z0-9_-]{43}$/.test(key) || decode64(key.slice(5)).length !== 32 || encode64(decode64(key.slice(5))) !== key.slice(5)) throw new Error('請輸入完整的 FIT1. 恢復金鑰');
  return key;
}
async function material(secret: string) { return crypto.subtle.importKey('raw', decode64(secret), 'HKDF', false, ['deriveBits', 'deriveKey']); }
async function bits(key: CryptoKey, info: string) { return encode64(new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: encoder.encode(info) }, key, 256))); }
async function aes(key: CryptoKey, info: string) { return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: encoder.encode(info) }, key, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
export async function deriveVault(recovery: string, endpoint: string) {
  const key = normalizeRecoveryKey(recovery); const raw = await material(key.slice(5));
  return { recoveryKey: key, vaultId: await bits(raw, 'vault-id/' + endpoint), authToken: await bits(raw, 'vault-auth/' + endpoint), encryptionKey: await aes(raw, 'vault-encryption/' + endpoint) };
}
async function collect(stream: ReadableStream<Uint8Array>, max: number): Promise<Uint8Array<ArrayBuffer>> {
  const reader = stream.getReader(); const parts: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > max) { await reader.cancel(); throw new Error('同步資料超過大小上限'); } parts.push(value); }
    const out = new Uint8Array(size); let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length; } return out;
  } finally { reader.releaseLock(); }
}
export async function encryptPacket(value: unknown, key: CryptoKey, purpose: string): Promise<Uint8Array<ArrayBuffer>> {
  const plaintext = encoder.encode(JSON.stringify(value)); if (plaintext.length > MAX_PLAINTEXT) throw new Error('同步資料超過 50 MB，請先匯出完整備份');
  const compressed = await collect(new Blob([plaintext]).stream().pipeThrough(new CompressionStream('gzip')), MAX_PACKET);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: encoder.encode('fitness-sync/1/' + purpose), tagLength: 128 }, key, compressed));
  const packet = new Uint8Array(13 + encrypted.length); packet[0] = 1; packet.set(nonce, 1); packet.set(encrypted, 13);
  if (packet.length > MAX_PACKET) throw new Error('壓縮後的同步資料超過上限');
  return packet;
}
export async function decryptPacket(packet: Uint8Array<ArrayBuffer>, key: CryptoKey, purpose: string): Promise<unknown> {
  if (packet.length < 30 || packet.length > MAX_PACKET || packet[0] !== 1) throw new Error('無法讀取這個同步版本');
  let compressed: ArrayBuffer;
  try { compressed = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: packet.slice(1, 13), additionalData: encoder.encode('fitness-sync/1/' + purpose), tagLength: 128 }, key, packet.slice(13)); }
  catch { throw new Error('金鑰不符，或加密資料驗證失敗'); }
  const plaintext = await collect(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')), MAX_PLAINTEXT);
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext)); } catch { throw new Error('同步資料格式不正確'); }
}
export async function newPairing() {
  const secret = encode64(crypto.getRandomValues(new Uint8Array(32))); return { code: 'PAIR1.' + secret, ...await derivePairing('PAIR1.' + secret) };
}
export async function derivePairing(code: string) {
  const value = code.replace(/\s+/g, '');
  if (!/^PAIR1\.[A-Za-z0-9_-]{43}$/.test(value)) throw new Error('請輸入完整的 PAIR1. 配對碼');
  const raw = await material(value.slice(6));
  return { id: await bits(raw, 'pair-id'), authToken: await bits(raw, 'pair-auth'), encryptionKey: await aes(raw, 'pair-encryption') };
}
