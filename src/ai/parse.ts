// 把模型回傳的 JSON 整理成 FoodGuess[]。模型的輸出一律當不可信資料：
// 超量截斷、重量夾進範圍、名稱限長，並且只取 name／altNames／grams／confidence——
// 就算模型多給了熱量或蛋白質之類的欄位也不讀（營養數字只由資料庫算）。

import { AI } from '../db/limits';
import type { FoodGuess } from './provider';
import { AiError } from './provider';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function cleanName(v: unknown): string {
  return typeof v === 'string' ? v.normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, AI.nameMax) : '';
}

/** 模型有時會用 ```json 包起來，先剝掉 */
function stripFence(text: string): string {
  const t = text.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return m ? m[1]! : t;
}

export function parseGuesses(text: string): FoodGuess[] {
  let raw: unknown;
  try {
    raw = JSON.parse(stripFence(text));
  } catch {
    throw new AiError('format', '辨識結果不是有效的 JSON');
  }
  const list = Array.isArray(raw) ? raw : isObj(raw) && Array.isArray(raw.foods) ? raw.foods : null;
  if (!list) throw new AiError('format', '辨識結果缺少 foods 陣列');

  const [gLo, gHi] = AI.gramsRange;
  const out: FoodGuess[] = [];
  const seen = new Set<string>();
  for (const it of list) {
    if (out.length >= AI.maxItems) break;
    if (!isObj(it)) continue;
    const name = cleanName(it.name);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const g = typeof it.grams === 'number' && Number.isFinite(it.grams) ? it.grams : 100;
    const c = typeof it.confidence === 'number' && Number.isFinite(it.confidence) ? it.confidence : 0.5;
    const altNames = Array.isArray(it.altNames)
      ? it.altNames.map(cleanName).filter((n) => n && n !== name).slice(0, AI.altNamesMax)
      : [];
    out.push({
      name,
      altNames,
      grams: Math.round(Math.min(gHi, Math.max(gLo, g))),
      confidence: Math.min(1, Math.max(0, c)),
      cooked: it.cooked === true,
    });
  }
  return out;
}
