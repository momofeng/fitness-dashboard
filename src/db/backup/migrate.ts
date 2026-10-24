// 備份檔的版本遷移。MIGRATIONS[n] 把 vN 的 tables 轉成 vN+1。
// Dexie 的 version(n+1).upgrade() 也要呼叫同一個函式，確保兩條路徑結果一致。

export type RawTables = Record<string, unknown[]>;

export const MIGRATIONS: Record<number, (tables: RawTables) => RawTables> = {
  // 例：1: (t) => ({ ...t, newTable: [] }),
};

export function migrateTables(tables: RawTables, from: number, to: number): RawTables {
  let out = tables;
  for (let v = from; v < to; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`缺少 v${v} → v${v + 1} 的遷移`);
    out = step(out);
  }
  return out;
}
