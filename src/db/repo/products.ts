// 我的產品（補給品與裝備同一張表，kind 區分）與補給品每日打卡。

import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { SUPPLEMENT_CATEGORIES } from '../../content/types';
import { db, newId } from '../db';
import { inRange, LIMITS } from '../limits';
import type { Product, SupplementLog } from '../schemas';

export type ProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

/** 寫入前檢查；回傳第一個錯誤訊息 */
export function validateProduct(p: ProductInput): string | null {
  if (!p.name.trim()) return '請輸入名稱';
  if (p.name.length > 60) return '名稱最多 60 字';
  if ((p.kind === 'supplement') !== (SUPPLEMENT_CATEGORIES as readonly string[]).includes(p.category)) return '類別與種類不符';
  const checks: Array<[keyof typeof LIMITS, number | null, string]> = [
    ['priceTwd', p.price, '價格'],
    ['servingsPerContainer', p.servingsPerContainer, '每罐份數'],
    ['proteinPerServingG', p.proteinPerServingG, '每份蛋白質'],
    ['dailyServings', p.dailyServings, '每天份數'],
    ['containers', p.containersBought, '已買罐數'],
    ['adjustServings', p.adjustServings, '庫存校正'],
    ['remindDays', p.remindDays, '提醒天數'],
  ];
  for (const [key, v, label] of checks) {
    if (v != null && !inRange(key, v)) return `${label}請輸入 ${LIMITS[key][0]}–${LIMITS[key][1]}`;
  }
  if (!Number.isInteger(p.containersBought) || !Number.isInteger(p.remindDays)) return '罐數與提醒天數必須是整數';
  return null;
}

export async function saveProduct(input: ProductInput): Promise<Product> {
  const err = validateProduct(input);
  if (err) throw new RangeError(err);
  const now = Date.now();
  const cur = input.id ? await db.products.get(input.id) : undefined;
  const row: Product = { ...input, name: input.name.trim(), brand: input.brand.trim(), id: input.id ?? newId(), createdAt: cur?.createdAt ?? now, updatedAt: now };
  await db.products.put(row);
  return row;
}

export async function deleteProduct(id: string): Promise<{ product: Product; logs: SupplementLog[] } | null> {
  return db.transaction('rw', db.products, db.supplementLogs, async () => {
    const product = await db.products.get(id);
    if (!product) return null;
    const logs = await logsOf(id);
    await db.supplementLogs.bulkDelete(logs.map((l) => l.id));
    await db.products.delete(id);
    return { product, logs };
  });
}

export async function restoreProduct(data: { product: Product; logs: SupplementLog[] }) {
  await db.transaction('rw', db.products, db.supplementLogs, async () => {
    await db.products.put(data.product);
    if (data.logs.length) await db.supplementLogs.bulkPut(data.logs);
  });
}

/** 補貨：已買罐數 +n，狀態改回使用中 */
export async function restock(id: string, n = 1) {
  await db.transaction('rw', db.products, async () => {
    const p = await db.products.get(id);
    if (!p) return;
    const next = Math.min(LIMITS.containers[1], p.containersBought + n);
    await db.products.update(id, { containersBought: next, status: 'using', updatedAt: Date.now() });
  });
}

// ---------- 打卡 ----------

export const supplementLogId = (productId: string, date: string) => `${productId}:${date}`;

function logsOf(productId: string) {
  return db.supplementLogs.where('[productId+date]').between([productId, Dexie.minKey], [productId, Dexie.maxKey]).toArray();
}

/** 設定某天吃了幾份；null = 取消打卡 */
export async function setCheckIn(productId: string, date: string, servings: number | null) {
  const id = supplementLogId(productId, date);
  if (servings == null) {
    await db.supplementLogs.delete(id);
    return;
  }
  if (!inRange('logServings', servings)) throw new RangeError(`份數請輸入 ${LIMITS.logServings[0]}–${LIMITS.logServings[1]}`);
  await db.supplementLogs.put({ id, productId, date, servings, updatedAt: Date.now() });
}

/** 每個產品累計打卡份數 */
export async function consumedByProduct(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  await db.supplementLogs.each((l) => out.set(l.productId, (out.get(l.productId) ?? 0) + l.servings));
  return out;
}

// ---------- hooks ----------

export function useProducts(): Product[] | undefined {
  return useLiveQuery(async () => (await db.products.toArray()).sort((a, b) => a.createdAt - b.createdAt), []);
}

export function useConsumed(): Map<string, number> | undefined {
  return useLiveQuery(consumedByProduct, []);
}

export function useSupplementLogsOn(date: string): SupplementLog[] | undefined {
  return useLiveQuery(() => db.supplementLogs.where('date').equals(date).toArray(), [date]);
}
