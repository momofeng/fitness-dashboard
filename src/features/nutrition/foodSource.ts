// 衛福部食品營養成分資料庫：build 時轉成欄位陣列格式的 JSON，第一次搜尋才載入，並由 service worker 預先快取（離線可用）。

import { useEffect, useState } from 'react';
import type { FoodItem } from '../../db/repo/foods';

export interface TfdaFile {
  source: string;
  dataset: string;
  license: string;
  version: string;
  generatedAt: string;
  fields: string[];
  rows: Array<Array<string | number | null>>;
}

export interface TfdaDb {
  version: string;
  items: FoodItem[];
  byKey: Map<string, FoodItem>;
}

/** 原型食物排前面、加工食品與調味料排後面 */
const CATEGORY_RANK: Record<string, number> = {
  肉類: 10,
  魚貝類: 10,
  蛋類: 10,
  乳品類: 8,
  穀物類: 8,
  澱粉類: 8,
  豆類: 8,
  蔬菜類: 8,
  水果類: 8,
  菇類: 6,
  藻類: 4,
  堅果及種子類: 4,
  飲料類: 0,
  油脂類: 0,
  糖類: -6,
  糕餅點心類: -8,
  加工調理食品及其他類: -10,
  調味料及香辛料類: -12,
};

let cache: Promise<TfdaDb> | null = null;

export function loadTfda(): Promise<TfdaDb> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/foods-tfda.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<TfdaFile>;
    })
    .then((f) => {
      const idx = Object.fromEntries(f.fields.map((k, i) => [k, i])) as Record<string, number>;
      const num = (v: unknown) => (typeof v === 'number' ? v : 0);
      const opt = (v: unknown) => (typeof v === 'number' ? v : undefined);
      const items: FoodItem[] = f.rows.map((r) => {
        const alias = String(r[idx.alias!] ?? '');
        const aliases = alias ? alias.split(/[,，、]/).map((a) => a.trim()).filter(Boolean) : [];
        const state = String(r[idx.state!] ?? '');
        // 樣品狀態（例如「生,雞胸部位」）也能搜尋；單字的「生」「熟」不列入，避免雜訊
        const stateWords = state.split(/[,，;；()（）]/).map((a) => a.trim()).filter((a) => a.length >= 2);
        // 「去皮雞胸肉」也要能用「雞胸」開頭比對
        const stripped = aliases.map((a) => a.replace(/^(去皮|帶皮|去骨|帶骨|無骨|生|熟)/, '')).filter((a, i) => a !== aliases[i] && a.length >= 2);
        const category = String(r[idx.category!] ?? '');
        return {
          key: `tfda:${r[idx.id!]}`,
          name: String(r[idx.name!]),
          aliases: [...aliases, ...stripped, ...stateWords],
          exactAliases: [...aliases, ...stripped],
          rank: (CATEGORY_RANK[category] ?? 0) + (/^生/.test(state) ? 3 : 0),
          sub: [aliases.slice(0, 2).join('、'), state.slice(0, 18), r[idx.category!]].filter(Boolean).join(' · ') + ' · 每 100 g',
          per: {
            basis: 'per100g',
            kcal: num(r[idx.kcal!]),
            protein: num(r[idx.protein!]),
            fat: num(r[idx.fat!]),
            carbs: num(r[idx.carbs!]),
            fiber: opt(r[idx.fiber!]),
            sodium: opt(r[idx.sodium!]),
          },
          // 每單位重是樣品平均（例如一顆蛋、一條地瓜），讓使用者可以用「份」記錄
          servingG: typeof r[idx.unitG!] === 'number' ? (r[idx.unitG!] as number) : null,
          servingLabel: typeof r[idx.unitG!] === 'number' ? `約 ${r[idx.unitG!]} g` : '',
          source: 'tfda',
          state,
        };
      });
      return { version: f.version, items, byKey: new Map(items.map((i) => [i.key, i])) };
    })
    .catch((e) => {
      cache = null;
      throw e;
    });
  return cache;
}

export function useTfda(): { db: TfdaDb | null; error: string | null } {
  const [state, setState] = useState<{ db: TfdaDb | null; error: string | null }>({ db: null, error: null });
  useEffect(() => {
    let alive = true;
    loadTfda().then(
      (db) => alive && setState({ db, error: null }),
      (e) => alive && setState({ db: null, error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
