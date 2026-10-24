// 備份檔的版本遷移。MIGRATIONS[n] 把 vN 的 tables 轉成 vN+1。
// Dexie 的 version(n+1).upgrade() 也呼叫同一個函式（見 db.ts 的 upgradeTables），確保兩條路徑結果一致。
// 遷移只做「補欄位、改格式」，不驗證；驗證交給之後的 Zod。

import { DEFAULT_PLATES_LB, DEFAULT_RECOVERY, DEFAULT_WARMUP, V2_DEFAULTS } from '../defaults';

export type RawTables = Record<string, unknown[]>;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const sub = (row: Obj, key: string): Obj => (isObj(row[key]) ? (row[key] as Obj) : {});
/** 只補缺的欄位，已有的值不動 */
const fill = (cur: Obj, defaults: Obj): Obj => {
  const out = { ...cur };
  for (const [k, v] of Object.entries(defaults)) if (out[k] === undefined) out[k] = structuredClone(v);
  return out;
};

/** v1 → v2：設定補上 Round 2 的新欄位（停滯門檻、暖身比例、EZ 槓、磅制槓片、自適應 TDEE、恢復、ZIP 備份時間） */
export function migrateSettingsV1toV2(row: unknown): unknown {
  if (!isObj(row)) return row;
  return {
    ...row,
    training: fill(sub(row, 'training'), { stallThresholdPct: V2_DEFAULTS.stallThresholdPct, warmup: DEFAULT_WARMUP }),
    equipment: fill(sub(row, 'equipment'), { ezBarKg: V2_DEFAULTS.ezBarKg, barLb: V2_DEFAULTS.barLb, platesLb: DEFAULT_PLATES_LB }),
    nutrition: fill(sub(row, 'nutrition'), { tdeeOverride: null, tdeeAppliedAt: null }),
    recovery: fill(sub(row, 'recovery'), DEFAULT_RECOVERY),
    backup: fill(sub(row, 'backup'), { lastFullExportAt: null }),
  };
}

export const MIGRATIONS: Record<number, (tables: RawTables) => RawTables> = {
  // v1 → v2：只有設定需要補欄位；其他表的新欄位都是選填，Round 2 預留表在 v1 沒有任何寫入介面
  1: (t) => (t.settings ? { ...t, settings: t.settings.map(migrateSettingsV1toV2) } : t),
};

/** 每個遷移會改到哪些表（Dexie upgrade 只需讀寫這些表） */
export const MIGRATION_TABLES: Record<number, string[]> = {
  1: ['settings'],
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
