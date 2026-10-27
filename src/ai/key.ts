// AI 金鑰只存這支手機的 localStorage：不進 IndexedDB、不進 JSON／ZIP 備份、不隨「資料與備份」匯出。
// 取捨：任何能打開這支手機瀏覽器的人都讀得到，所以設定頁會提醒使用專用金鑰並設用量上限。
// localStorage 可能被擋（無痕、清除網站資料、隱私設定），每次存取都包 try/catch。

import { AI } from '../db/limits';

export const AI_KEY_STORAGE = 'fitness.ai.key';

export function readAiKey(): string | null {
  try {
    const v = localStorage.getItem(AI_KEY_STORAGE)?.trim();
    return v ? v : null;
  } catch {
    return null;
  }
}

/** 回傳是否存成功；金鑰格式不做驗證（交給「測試連線」） */
export function saveAiKey(key: string): boolean {
  const k = key.trim();
  if (!k || k.length > AI.keyMax || /\s/.test(k)) return false;
  try {
    localStorage.setItem(AI_KEY_STORAGE, k);
    return true;
  } catch {
    return false;
  }
}

export function clearAiKey(): void {
  try {
    localStorage.removeItem(AI_KEY_STORAGE);
  } catch {
    /* 存取被擋時沒有東西可清 */
  }
}

/** 只顯示末 4 碼，確認「存的是哪一把」 */
export function maskKey(key: string): string {
  return key.length <= 4 ? '••••' : `••••${key.slice(-4)}`;
}
