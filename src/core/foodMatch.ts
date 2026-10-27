// AI 辨識出的食物名稱 → 資料庫食物。純函式：不碰 DOM、Dexie；營養數字不在這裡，只負責「選哪個食物」。
// 順序：你以前校正過的對應 > 名稱／俗名比對（本名分數最高，同義名略減）> 都對不上時用名稱的前後片段找（一律標為不確定）。

import { matchScore, normalizeText, type Searchable } from './search';

export interface GuessLike {
  name: string;
  altNames?: string[];
  /** 這項是否已煮熟；有的話優先挑熟的樣品，沒有就偏向生的 */
  cooked?: boolean;
}

export interface MatchCandidate<T> {
  item: T;
  score: number;
  via: 'learned' | 'name' | 'alt' | 'partial';
  /** 查詢字串與食物的名稱、本名（去掉括號註記）或真正的俗名完全相同。只是「包含」或只出現在成分字樣裡不算 */
  exact: boolean;
}

export interface MatchResult<T> {
  candidates: Array<MatchCandidate<T>>;
  /** true = 有把握（你校正過，或名稱／俗名完全相同且沒有其他同樣好的選項）；false 的列要請使用者確認 */
  confident: boolean;
}

/** 同義名的信任度略低於 AI 的主名稱 */
const ALT_PENALTY = 15;
const PARTIAL_PENALTY = 30;
const LEARNED_SCORE = 10_000;

/**
 * exactAliases：真正的俗名（衛福部資料庫「俗名」欄，含去掉「去皮」等前綴的寫法）。
 * aliases 另外混了樣品狀態裡的成分字樣（為了能搜尋），那些不能拿來判斷「就是這個食物」：
 * 例如「乳清蛋白」只是優格的成分描述，不是優格的俗名。沒有 exactAliases 的（自建食物）退回用 aliases。
 */
type Keyed = Searchable & { key: string; state?: string; exactAliases?: string[] };

export function isExact(item: Keyed, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return false;
  if (normalizeText(item.name) === q) return true;
  if (normalizeText(item.name.replace(/[(（][^)）]*[)）]/g, '')) === q) return true;
  return (item.exactAliases ?? item.aliases ?? []).some((a) => normalizeText(a) === q);
}

const COOKED = /熟|煮|烤|炒|蒸|炸|滷|煎|燙|烘|焙/;
const STATE_BONUS = 12;

/**
 * 樣品狀態的加分：煮熟的食物優先挑熟的樣品；沒煮的略偏向生的。
 * 煮熟時不懲罰生的樣品——否則「冷凍」「鹽漬」這類既不是生也不是熟的樣品會被抬到生的前面。
 */
function stateAdjust(state: string | undefined, cooked: boolean | undefined): number {
  if (!state) return 0;
  const raw = /^生/.test(state);
  if (cooked) return COOKED.test(state) && !raw ? STATE_BONUS : 0;
  return raw ? 4 : 0;
}

function best<T extends Keyed>(items: T[], query: string, cooked: boolean | undefined, boost?: (i: T) => number): Array<{ item: T; exact: boolean; score: number }> {
  const out: Array<{ item: T; exact: boolean; score: number }> = [];
  for (const item of items) {
    const raw = matchScore(item, query);
    if (raw > 0) out.push({ item, exact: isExact(item, query), score: raw + (item.rank ?? 0) + (boost?.(item) ?? 0) + stateAdjust(item.state, cooked) });
  }
  return out;
}

/** 名稱的前綴與後綴片段（長的優先，至少 2 字）：炒高麗菜 → 高麗菜、炒高麗 … */
export function fragments(name: string): string[] {
  const n = normalizeText(name);
  const chars = [...n];
  const out: string[] = [];
  for (let len = chars.length - 1; len >= 2; len--) {
    out.push(chars.slice(chars.length - len).join(''));
    out.push(chars.slice(0, len).join(''));
  }
  return [...new Set(out)];
}

export function matchGuess<T extends Keyed>(
  guess: GuessLike,
  items: T[],
  byKey: (key: string) => T | undefined,
  learned: ReadonlyMap<string, string>,
  opts: { boost?: (item: T) => number; limit?: number } = {},
): MatchResult<T> {
  const limit = opts.limit ?? 5;
  const merged = new Map<string, MatchCandidate<T>>();
  const put = (item: T, exact: boolean, score: number, via: MatchCandidate<T>['via']) => {
    const cur = merged.get(item.key);
    if (!cur || score > cur.score) merged.set(item.key, { item, exact, score, via });
  };

  const learnedKey = learned.get(normalizeText(guess.name));
  const learnedItem = learnedKey ? byKey(learnedKey) : undefined;
  if (learnedItem) put(learnedItem, true, LEARNED_SCORE, 'learned');

  for (const h of best(items, guess.name, guess.cooked, opts.boost)) put(h.item, h.exact, h.score, 'name');
  for (const alt of guess.altNames ?? []) {
    if (normalizeText(alt) === normalizeText(guess.name)) continue;
    for (const h of best(items, alt, guess.cooked, opts.boost)) put(h.item, h.exact, h.score - ALT_PENALTY, 'alt');
  }

  // 完全沒有任何結果才退到片段比對（「炒高麗菜」→「高麗菜」）；這種結果永遠不算有把握
  if (merged.size === 0) {
    for (const frag of fragments(guess.name)) {
      const hits = best(items, frag, guess.cooked, opts.boost);
      if (hits.length) {
        for (const h of hits) put(h.item, false, h.score - PARTIAL_PENALTY, 'partial');
        break;
      }
    }
  }

  const candidates = [...merged.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  const top = candidates[0];
  let confident = false;
  if (top?.via === 'learned') confident = true;
  else if (top?.via === 'name' && top.exact) {
    // 「完全相同」的選項有兩個以上（例如生／熟兩種樣品）→ 請使用者確認
    confident = candidates.filter((c) => c.via === 'name' && c.exact).length === 1;
  }
  return { candidates, confident };
}
