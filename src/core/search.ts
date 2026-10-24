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
  const aliases = (item.aliases ?? []).map(normalizeText);
  let score = 0;
  for (const t of tokens) {
    if (name === t) score += 100;
    else if (name.startsWith(t)) score += 70;
    else if (name.includes(t)) score += 50;
    else if (aliases.some((a) => a === t)) score += 45;
    else if (aliases.some((a) => a.includes(t))) score += 30;
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
    if (s > 0) scored.push({ item, score: s + (boost?.(item) ?? 0) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.item);
}
