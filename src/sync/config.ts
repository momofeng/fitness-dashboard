export const HOSTED_SYNC_ENDPOINT = 'https://fitness-sync-vault-a176ab.momofeng592.chatgpt.site/api';
export const DEFAULT_SYNC_ENDPOINT = import.meta.env.DEV ? 'http://127.0.0.1:8788/api' : HOSTED_SYNC_ENDPOINT;
export function normalizeEndpoint(value: string): string {
  const url = new URL(value.trim());
  if (url.username || url.password || url.search || url.hash) throw new Error('同步服務網址格式不正確');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('同步服務必須使用 HTTPS');
  return url.toString().replace(/\/$/, '');
}
