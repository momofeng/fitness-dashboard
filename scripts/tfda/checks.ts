// 衛福部食品營養成分資料庫轉換：純函式（長格式 → 寬格式、數值解析、品質檢查），有單元測試。

export interface RawRow {
  整合編號: string;
  樣品名稱: string;
  俗名: string | null;
  食品分類: string;
  內容物描述: string | null;
  分析項: string;
  含量單位: string | null;
  每100克含量: string | number | null;
  每單位重?: string | null;
}

/** 分析項 → 欄位與必要單位。熱量採「修正熱量」（碳水扣除膳食纖維、纖維以 2 kcal/g 計） */
export const FIELD_MAP = {
  修正熱量: { key: 'kcal', unit: 'kcal' },
  粗蛋白: { key: 'protein', unit: 'g' },
  粗脂肪: { key: 'fat', unit: 'g' },
  總碳水化合物: { key: 'carbs', unit: 'g' },
  膳食纖維: { key: 'fiber', unit: 'g' },
  鈉: { key: 'sodium', unit: 'mg' },
  水分: { key: 'water', unit: 'g' },
  灰分: { key: 'ash', unit: 'g' },
  酒精含量: { key: 'alcohol', unit: 'g' },
} as const;

type FieldKey = (typeof FIELD_MAP)[keyof typeof FIELD_MAP]['key'];
export const REQUIRED: FieldKey[] = ['kcal', 'protein', 'fat', 'carbs'];

export interface WideFood {
  id: string;
  name: string;
  alias: string;
  category: string;
  state: string;
  /** 每單位重（樣品平均，例如一顆、一片），沒有為 null */
  unitG: number | null;
  values: Partial<Record<FieldKey, number>>;
}

/** 數值字串去空白；空白、null、「-」都算缺值，不當成 0 */
export function parseAmount(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = v.trim();
  if (t === '' || t === '-' || t === '—') return null;
  if (!/^-?\d+(\.\d+)?$/.test(t)) throw new Error(`無法解析的數值：「${v}」`);
  return Number(t);
}

/** 「121.0克」→ 121；0 或無法解析 → null */
export function parseUnitWeight(v: string | null | undefined): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*克\s*$/.exec(v ?? '');
  const n = m ? Number(m[1]) : 0;
  return n > 0 ? n : null;
}

export function sampleState(desc: string | null): string {
  const m = /樣品狀態:([^;]+)/.exec(desc ?? '');
  return m ? m[1]!.trim() : '';
}

/** 長格式（一列＝一食物×一分析項）轉成一食物一列；單位不符就直接失敗 */
export function toWide(rows: RawRow[]): WideFood[] {
  const map = new Map<string, WideFood>();
  for (const r of rows) {
    const id = String(r.整合編號).trim();
    let f = map.get(id);
    if (!f) {
      f = {
        id,
        name: String(r.樣品名稱).trim().replace(/\s+/g, ' '),
        alias: (r.俗名 ?? '').trim(),
        category: String(r.食品分類).trim(),
        state: sampleState(r.內容物描述),
        unitG: parseUnitWeight(r.每單位重),
        values: {},
      };
      map.set(id, f);
    }
    const spec = FIELD_MAP[r.分析項 as keyof typeof FIELD_MAP];
    if (!spec) continue;
    if ((r.含量單位 ?? '').trim() !== spec.unit) {
      throw new Error(`${id} ${r.分析項} 單位為「${r.含量單位}」，預期 ${spec.unit}`);
    }
    if (spec.key in f.values) throw new Error(`${id} ${r.分析項} 重複出現`);
    const n = parseAmount(r.每100克含量);
    if (n != null && n < 0) throw new Error(`${id} ${r.分析項} 為負值 ${n}`);
    if (n != null) f.values[spec.key] = n;
  }
  return [...map.values()];
}

/** 依修正熱量的算法推算：4P + 4(C−纖維) + 2×纖維 + 9F + 7×酒精 */
export function expectedKcal(v: WideFood['values']): number | null {
  const { protein: p, fat: f, carbs: c } = v;
  if (p == null || f == null || c == null) return null;
  const fib = v.fiber ?? 0;
  return 4 * p + 4 * Math.max(0, c - fib) + 2 * Math.min(fib, c) + 9 * f + 7 * (v.alcohol ?? 0);
}

export interface CheckReport {
  total: number;
  kept: number;
  excluded: Array<{ id: string; name: string; missing: string[] }>;
  coverage: Record<string, number>;
  energy: { checked: number; outliers: Array<{ id: string; name: string; kcal: number; expected: number }>; outlierRate: number };
  mass: { checked: number; within: number; rate: number };
  errors: string[];
}

export const LIMITS = { energyOutlierRate: 0.03, massWithinRate: 0.95 };

export function checkFoods(foods: WideFood[]): CheckReport {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const f of foods) {
    if (ids.has(f.id)) errors.push(`整合編號重複：${f.id}`);
    ids.add(f.id);
    if (!f.name) errors.push(`${f.id} 沒有名稱`);
  }
  const excluded = foods
    .map((f) => ({ id: f.id, name: f.name, missing: REQUIRED.filter((k) => f.values[k] == null) }))
    .filter((x) => x.missing.length > 0);
  const kept = foods.filter((f) => REQUIRED.every((k) => f.values[k] != null));

  const coverage: Record<string, number> = {};
  for (const spec of Object.values(FIELD_MAP)) coverage[spec.key] = kept.filter((f) => f.values[spec.key] != null).length / Math.max(1, kept.length);

  const outliers: CheckReport['energy']['outliers'] = [];
  let checked = 0;
  for (const f of kept) {
    const exp = expectedKcal(f.values);
    if (exp == null) continue;
    checked++;
    const kcal = f.values.kcal!;
    if (Math.abs(kcal - exp) > Math.max(15, 0.15 * Math.max(kcal, exp))) outliers.push({ id: f.id, name: f.name, kcal, expected: Math.round(exp) });
  }
  const outlierRate = outliers.length / Math.max(1, checked);
  if (outlierRate > LIMITS.energyOutlierRate) {
    errors.push(`熱量一致性離群 ${(outlierRate * 100).toFixed(1)}% 超過 ${LIMITS.energyOutlierRate * 100}%，可能是分析項對照錯誤`);
  }

  // 碳水是差減法：水分＋蛋白質＋脂肪＋碳水＋灰分 ≈ 100 g，用來抓欄位錯位
  let massChecked = 0;
  let within = 0;
  for (const f of kept) {
    const { water, protein, fat, carbs, ash } = f.values;
    if ([water, protein, fat, carbs, ash].some((v) => v == null)) continue;
    massChecked++;
    const sum = water! + protein! + fat! + carbs! + ash!;
    if (sum >= 98 && sum <= 102) within++;
  }
  const massRate = within / Math.max(1, massChecked);
  if (massRate < LIMITS.massWithinRate) errors.push(`成分加總落在 98–102 g 的比例只有 ${(massRate * 100).toFixed(1)}%`);

  if (kept.length < 1000) errors.push(`可用食物只有 ${kept.length} 筆，資料可能不完整`);

  return {
    total: foods.length,
    kept: kept.length,
    excluded,
    coverage,
    energy: { checked, outliers, outlierRate },
    mass: { checked: massChecked, within, rate: massRate },
    errors,
  };
}

export const OUTPUT_FIELDS = ['id', 'name', 'alias', 'category', 'state', 'kcal', 'protein', 'fat', 'carbs', 'fiber', 'sodium', 'unitG'] as const;

const r1 = (n: number | undefined) => (n == null ? null : Math.round(n * 10) / 10);

export function toOutputRows(foods: WideFood[]): Array<Array<string | number | null>> {
  return foods
    .filter((f) => REQUIRED.every((k) => f.values[k] != null))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((f) => [f.id, f.name, f.alias, f.category, f.state, r1(f.values.kcal), r1(f.values.protein), r1(f.values.fat), r1(f.values.carbs), r1(f.values.fiber), r1(f.values.sodium), f.unitG]);
}
