// 中文搜尋：全形轉半形、去空白、轉小寫，多個關鍵字都要命中。

export function normalizeText(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s　·・、,，.。()（）\[\]【】「」'"\-_/]+/g, '');
}

export interface Searchable {
  name: string;
  aliases?: string[];
  /** 額外排序加權（例如原型食物加分、加工食品減分） */
  rank?: number;
}

/** 回傳分數（0 = 不符合）。名稱完全相同 > 開頭相同 > 包含 > 只在別名中 */
export function matchScore(item: Searchable, query: string): number {
  const tokens = query
    .normalize('NFKC')
    .toLowerCase()
    .split(/[\s　]+/)
    .map(normalizeText)
    .filter(Boolean);
  if (tokens.length === 0) return 0;
  const name = normalizeText(item.name);
  // 去掉括號註記後的本名：「雞蛋(白殼)」的本名是「雞蛋」
  const base = normalizeText(item.name.replace(/[(（][^)）]*[)）]/g, ''));
  const aliases = (item.aliases ?? []).map(normalizeText);
  let score = 0;
  for (const t of tokens) {
    // 俗名完全相同代表「大家就是這樣叫它」（例：全脂鮮乳的俗名是牛奶），權重僅次於名稱完全相同
    if (name === t) score += 100;
    else if (base === t) score += 98;
    else if (aliases.some((a) => a === t)) score += 95;
    else if (name.startsWith(t)) score += 70;
    else if (aliases.some((a) => a.startsWith(t))) score += 60;
    else if (name.includes(t)) score += 50;
    else if (aliases.some((a) => a.includes(t))) score += 40;
    else return 0;
  }
  // 名稱越短越可能是「原型食物本身」，略加分
  return score + Math.max(0, 20 - name.length);
}

export function searchItems<T extends Searchable>(
  items: T[],
  query: string,
  limit = 50,
  boost?: (item: T) => number,
): T[] {
  const scored: Array<{ item: T; score: number }> = [];
  for (const item of items) {
    const s = matchScore(item, query);
    if (s > 0) scored.push({ item, score: s + (item.rank ?? 0) + (boost?.(item) ?? 0) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.item);
}
