// 我的產品：成本、CP 值、庫存估算。純函式，金額單位是新台幣。

export interface StockFields {
  servingsPerContainer: number | null;
  containersBought: number;
  adjustServings: number;
}

/** 買進的總份數（含校正） */
export function servingsBought(p: StockFields): number {
  return (p.servingsPerContainer ?? 0) * p.containersBought + p.adjustServings;
}

/** 剩餘份數；可能是負的（打卡比買的多），畫面上提示去校正 */
export function servingsLeft(p: StockFields, consumed: number): number {
  return Number((servingsBought(p) - consumed).toFixed(2));
}

/** 依每日份數估計還能吃幾天；沒設定每日份數時回傳 null */
export function daysLeft(left: number, dailyServings: number | null): number | null {
  if (!dailyServings || dailyServings <= 0) return null;
  return Math.max(0, Math.floor(left / dailyServings));
}

export interface RestockFields extends StockFields {
  status: 'using' | 'candidate' | 'finished';
  dailyServings: number | null;
  remindDays: number;
}

/** 使用中、有設每日份數、剩餘天數 ≤ 提醒天數 → 該補貨了 */
export function needsRestock(p: RestockFields, consumed: number): boolean {
  // 沒填每罐份數就無法估庫存，不提醒（否則一新增就顯示「該補貨」）
  if (p.status !== 'using' || p.remindDays <= 0 || !p.servingsPerContainer || p.servingsPerContainer <= 0) return false;
  const d = daysLeft(servingsLeft(p, consumed), p.dailyServings);
  return d != null && d <= p.remindDays;
}

export function costPerServing(price: number | null, servings: number | null): number | null {
  if (price == null || !servings || servings <= 0) return null;
  return price / servings;
}

/** 每克蛋白質的成本（元／g） */
export function costPerGramProtein(price: number | null, servings: number | null, proteinPerServingG: number | null): number | null {
  if (price == null || !servings || servings <= 0 || !proteinPerServingG || proteinPerServingG <= 0) return null;
  return price / (servings * proteinPerServingG);
}

export interface CostFields {
  price: number | null;
  servingsPerContainer: number | null;
  proteinPerServingG: number | null;
}

/** 蛋白粉依每克蛋白質成本排序，其他依每份成本；算不出來的排最後 */
export function rankByValue<T extends CostFields>(items: T[], by: 'protein' | 'serving'): Array<T & { cost: number | null }> {
  const withCost = items.map((p) => ({
    ...p,
    cost: by === 'protein' ? costPerGramProtein(p.price, p.servingsPerContainer, p.proteinPerServingG) : costPerServing(p.price, p.servingsPerContainer),
  }));
  return withCost.sort((a, b) => (a.cost == null ? 1 : b.cost == null ? -1 : a.cost - b.cost));
}

/** 裝備每次訓練的成本 */
export function gearCostPerSession(price: number | null, sessions: number): number | null {
  if (price == null || sessions <= 0) return null;
  return price / sessions;
}
