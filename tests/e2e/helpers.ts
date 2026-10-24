import { expect, type Page } from '@playwright/test';

export const DB_NAME = 'momofeng-fitness-dashboard';

/** 透過 UI 完成首次設定（體重 70 kg、預設新手槓鈴課表） */
export async function onboard(page: Page, opts: { weight?: string; template?: string } = {}) {
  await page.goto('./');
  await expect(page).toHaveURL(/#\/onboarding/);
  await page.getByRole('checkbox', { name: '我了解，開始設定' }).check();
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByLabel('目前體重').fill(opts.weight ?? '70');
  await page.getByLabel('身高').fill('175');
  await page.getByLabel('出生年').fill('1996');
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page.getByText('每日目標熱量')).toBeVisible();
  await page.getByRole('button', { name: '下一步' }).click();
  if (opts.template) await page.getByRole('radio', { name: new RegExp(opts.template) }).click();
  await page.getByRole('button', { name: '完成，開始使用' }).click();
  await expect(page).not.toHaveURL(/onboarding/);
}

/** 直接寫入 IndexedDB（App 先載入過，Dexie 已建立資料表），寫完重新整理 */
export async function putRows(page: Page, table: string, rows: unknown[]) {
  await page.evaluate(
    async ({ dbName, table, rows }) => {
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open(dbName);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise<void>((res, rej) => {
        const tx = db.transaction(table, 'readwrite');
        for (const row of rows) tx.objectStore(table).put(row);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { dbName: DB_NAME, table, rows },
  );
}

export async function readAll<T = Record<string, unknown>>(page: Page, table: string): Promise<T[]> {
  return page.evaluate(
    async ({ dbName, table }) => {
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open(dbName);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const out = await new Promise<unknown[]>((res, rej) => {
        const req = db.transaction(table).objectStore(table).getAll();
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      db.close();
      return out;
    },
    { dbName: DB_NAME, table },
  ) as Promise<T[]>;
}

/** 檢查頁面沒有水平捲動，且沒有元素超出視窗右緣 */
export async function expectNoHorizontalOverflow(page: Page, label: string) {
  const result = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const offenders: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.position === 'fixed' && r.right <= vw + 1) continue;
      // 被祖先 overflow 裁掉的元素看不到，不算
      let clipped = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (/(hidden|auto|scroll|clip)/.test(ps.overflowX)) {
          const pr = p.getBoundingClientRect();
          if (pr.right <= vw + 1) clipped = true;
          break;
        }
      }
      if (!clipped && r.right > vw + 1) offenders.push(`${el.tagName.toLowerCase()}.${(el as HTMLElement).className?.toString().slice(0, 60)} right=${Math.round(r.right)}`);
    }
    return { scroll: document.documentElement.scrollWidth, vw, offenders: offenders.slice(0, 5) };
  });
  expect(result.scroll, `${label}: scrollWidth`).toBeLessThanOrEqual(result.vw);
  expect(result.offenders, `${label}: 超出右緣的元素`).toEqual([]);
}
