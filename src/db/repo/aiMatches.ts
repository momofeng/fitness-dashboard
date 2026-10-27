// 「記住我的校正」：AI 辨識出的名稱（正規化後）→ 你選定的資料庫食物。下次同名優先對應，越用越準。

import { useLiveQuery } from 'dexie-react-hooks';
import { normalizeText } from '../../core/search';
import { db } from '../db';
import { AI } from '../limits';
import type { AiMatch } from '../schemas';

/** norm → foodKey；undefined = 還在讀取 */
export function useAiMatches(): Map<string, string> | undefined {
  return useLiveQuery(async () => new Map((await db.aiMatches.toArray()).map((m) => [m.norm, m.foodKey])), []);
}

/**
 * 確認加入後記住這次的對應。同一批裡同名只算最後一個（先在記憶體合併再各讀寫一次）；
 * 對應到同一個食物就累加次數，改成別的食物就取代並從 1 重算。超過上限刪掉最舊的。
 */
export async function rememberMatches(pairs: Array<{ name: string; foodKey: string }>): Promise<void> {
  const latest = new Map<string, string>();
  for (const p of pairs) {
    const norm = normalizeText(p.name).slice(0, AI.nameMax);
    if (norm && p.foodKey) latest.set(norm, p.foodKey);
  }
  if (!latest.size) return;
  const now = Date.now();
  await db.transaction('rw', db.aiMatches, async () => {
    const norms = [...latest.keys()];
    const cur = await db.aiMatches.bulkGet(norms);
    const rows: AiMatch[] = norms.map((norm, i) => {
      const foodKey = latest.get(norm)!;
      const prev = cur[i];
      return { norm, foodKey, count: prev && prev.foodKey === foodKey ? prev.count + 1 : 1, updatedAt: now };
    });
    await db.aiMatches.bulkPut(rows);
    const total = await db.aiMatches.count();
    if (total > AI.matchesMax) {
      const oldest = await db.aiMatches.orderBy('updatedAt').limit(total - AI.matchesMax).primaryKeys();
      await db.aiMatches.bulkDelete(oldest);
    }
  });
}
