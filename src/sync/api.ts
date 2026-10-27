import { MAX_PACKET } from './crypto';
export class SyncHttpError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
const messages: Record<number, string> = { 401: '金鑰不符或同步空間不存在', 404: '配對碼已到期、已使用或找不到版本', 409: '另一裝置剛更新資料，正在重新確認', 413: '同步資料超過上限，請先匯出完整備份', 429: '操作次數較多，請稍後再試', 503: '同步服務暫時無法使用，紀錄仍保留在本機' };
export async function api(endpoint: string, path: string, token: string, init: RequestInit = {}) {
  let response: Response;
  try { response = await fetch(endpoint + '/v1/' + path, { ...init, cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Authorization: 'Bearer ' + token, ...init.headers } }); }
  catch { throw new Error('無法連線到同步服務；本機紀錄不受影響'); }
  if (!response.ok) throw new SyncHttpError(response.status, messages[response.status] ?? '同步服務回應異常，請稍後重試');
  return response;
}
export async function readPacket(response: Response): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(response.headers.get('content-length')) > MAX_PACKET) throw new Error('雲端版本超過大小上限');
  const reader = response.body?.getReader(); if (!reader) throw new Error('雲端版本是空的');
  const parts: Uint8Array[] = []; let size = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > MAX_PACKET) { await reader.cancel(); throw new Error('雲端版本超過大小上限'); } parts.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.length; } return bytes;
}
