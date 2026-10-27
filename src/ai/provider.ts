// AI 辨識：拍照／一句話輸入 → 食物名稱 + 估計公克數。
// 規則（專案 CLAUDE.md）：食物營養數字一律不由 AI 產生。這裡的回傳型別刻意不含任何營養欄位，
// 熱量與三大營養素由呼叫端拿名稱去對應衛福部資料庫、再依重量換算。
// 金鑰由使用者自行輸入，只存在這支手機的 localStorage（見 key.ts），不寫進程式碼、不進備份。

import { AI } from '../db/limits';
import type { Settings } from '../db/schemas';
import { readAiKey } from './key';

export interface FoodGuess {
  /** 台灣常用的食材通用名稱，用來比對資料庫 */
  name: string;
  /** 同義或較上位的名稱（最多 3 個），提高對得上資料庫的機率 */
  altNames: string[];
  /** 照片／描述中「可食用部分」的估計公克數 */
  grams: number;
  /** 0–1 */
  confidence: number;
  /** 照片／描述中的這項是否已煮熟或料理過（資料庫多數只有生重的數值，要提醒使用者） */
  cooked: boolean;
}

export interface CoachAdvice {
  summary: string;
  suggestions: string[];
}

export type AiErrorCode =
  | 'disabled' // 沒有啟用或沒有金鑰
  | 'offline'
  | 'timeout'
  | 'aborted'
  | 'auth' // 金鑰無效或沒有權限
  | 'quota' // 額度用完或太頻繁
  | 'blocked' // 內容被模型端擋下
  | 'network'
  | 'format' // 回應不是預期的格式
  | 'unsupported';

export class AiError extends Error {
  readonly code: AiErrorCode;
  /** 供應商回的原始訊息（給「測試連線」顯示，不含金鑰） */
  readonly detail?: string;

  constructor(code: AiErrorCode, message: string, detail?: string) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.detail = detail;
  }
}

export interface AiProvider {
  readonly id: string;
  readonly available: boolean;
  recognizePhoto(image: Blob, signal?: AbortSignal): Promise<FoodGuess[]>;
  parseText(text: string, signal?: AbortSignal): Promise<FoodGuess[]>;
  coach(context: { recentWorkouts: unknown[]; weightTrend: unknown; targets: unknown }): Promise<CoachAdvice>;
}

const disabled = () => Promise.reject(new AiError('disabled', 'AI 辨識尚未啟用'));

export const NullProvider: AiProvider = {
  id: 'none',
  available: false,
  recognizePhoto: disabled,
  parseText: disabled,
  coach: disabled,
};

export function aiReady(ai: Settings['ai']): boolean {
  return ai.enabled && !!readAiKey();
}

/** 依設定取得 provider。Gemini 的實作用動態載入，沒用到 AI 的使用者不會下載它 */
export async function getAiProvider(ai: Settings['ai']): Promise<AiProvider> {
  const key = readAiKey();
  if (!ai.enabled || !key) return NullProvider;
  const { createGeminiProvider } = await import('./gemini');
  return createGeminiProvider({ key, model: ai.model?.trim() || AI.defaultModel });
}

export function aiErrorMessage(e: unknown): string {
  if (e instanceof AiError) {
    switch (e.code) {
      case 'disabled':
        return '請先到「設定 → AI 辨識」啟用並貼上金鑰。';
      case 'offline':
        return '目前沒有網路，AI 辨識需要連線。可以改用搜尋食物。';
      case 'timeout':
        return '辨識逾時，請稍後再試，或改用搜尋食物。';
      case 'aborted':
        return '已取消。';
      case 'auth':
        return '金鑰無效或沒有權限，請到「設定 → AI 辨識」確認。';
      case 'quota':
        return '額度用完或請求太頻繁，請稍後再試。';
      case 'blocked':
        return '這張照片沒有辨識結果（被模型端擋下），請換一張或改用搜尋。';
      case 'network':
        return '連線失敗，請檢查網路後再試。';
      case 'format':
        return '辨識結果格式不正確，請再試一次。';
      case 'unsupported':
        return '這個功能還沒支援。';
    }
  }
  return e instanceof Error ? e.message : '辨識失敗';
}
