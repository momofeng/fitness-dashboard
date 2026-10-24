// AI 功能（第二階段）：拍照估熱量、AI 教練建議。
// 首版只定介面與 NullProvider；實作時金鑰由使用者自行輸入並只存在自己的裝置，不寫進程式碼。

import type { Nutrients } from '../core/nutrition';

export interface FoodEstimate {
  name: string;
  grams: number;
  nutrients: Nutrients;
  confidence: number;
}

export interface CoachAdvice {
  summary: string;
  suggestions: string[];
}

export interface AiProvider {
  readonly id: string;
  readonly available: boolean;
  estimateFoodFromPhoto(image: Blob): Promise<FoodEstimate[]>;
  coach(context: { recentWorkouts: unknown[]; weightTrend: unknown; targets: unknown }): Promise<CoachAdvice>;
}

export const NullProvider: AiProvider = {
  id: 'none',
  available: false,
  estimateFoodFromPhoto() {
    return Promise.reject(new Error('AI 功能尚未啟用'));
  },
  coach() {
    return Promise.reject(new Error('AI 功能尚未啟用'));
  },
};

export function getAiProvider(): AiProvider {
  return NullProvider;
}
