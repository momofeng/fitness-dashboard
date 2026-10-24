// 補給品知識卡的來源規範：每條宣稱都要有可查證的來源，不提品牌，用台灣繁體中文。

import { describe, expect, it } from 'vitest';
import { GRADE_INFO, SOURCES, SUPPLEMENT_CARDS, SUPPLEMENT_DISCLAIMER } from './supplementCards';
import { PRODUCT_CATEGORIES } from './types';

const BRANDS = ['optimum', 'myprotein', 'dymatize', 'muscletech', 'bsn', 'kaged', 'nutricost', 'gold standard', 'iherb', 'amazon', 'costco', '好市多', '亞培', '桂格', '安琪', '大研', '台塑', '白蘭氏'];
// 只會出現在簡體中文的字（台灣繁體不會用到）
const SIMPLIFIED = /[这们为时会对发现应经过还进动补给维营体质说剂单类检险药肾肠钙铁锌]/;

const allText = (c: (typeof SUPPLEMENT_CARDS)[number]) =>
  [c.name, ...c.aka, c.oneLiner, c.whatItIs, c.forYou, ...c.skipIf, ...[...c.claims, ...c.dose, ...c.safety].map((x) => x.text)].join('\n');

describe('補給品知識卡', () => {
  it('12–15 張，id 唯一且是 kebab-case', () => {
    expect(SUPPLEMENT_CARDS.length).toBeGreaterThanOrEqual(12);
    expect(SUPPLEMENT_CARDS.length).toBeLessThanOrEqual(15);
    const ids = SUPPLEMENT_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it.each(SUPPLEMENT_CARDS.map((c) => [c.id, c] as const))('%s：每條宣稱都有存在的來源、欄位長度合規', (_id, c) => {
    expect(Object.keys(GRADE_INFO)).toContain(c.grade);
    expect(c.claims.length).toBeGreaterThan(0);
    expect(c.dose.length).toBeGreaterThan(0);
    expect(c.safety.length).toBeGreaterThan(0);
    for (const claim of [...c.claims, ...c.dose, ...c.safety]) {
      expect(claim.sources.length, claim.text).toBeGreaterThan(0);
      for (const s of claim.sources) expect(SOURCES, `${c.id}：${s}`).toHaveProperty(s);
    }
    expect([...c.oneLiner].length).toBeLessThanOrEqual(40);
    expect([...c.whatItIs].length).toBeLessThanOrEqual(120);
    expect([...c.forYou].length).toBeLessThanOrEqual(150);
    if (c.productCategory) expect(PRODUCT_CATEGORIES).toContain(c.productCategory);
  });

  it.each(SUPPLEMENT_CARDS.map((c) => [c.id, c] as const))('%s：不提品牌、沒有簡體字', (_id, c) => {
    const text = allText(c);
    for (const b of BRANDS) expect(text.toLowerCase(), `品牌：${b}`).not.toContain(b);
    expect(text, '簡體字').not.toMatch(SIMPLIFIED);
  });

  it('每個來源都有 PMID／DOI 或是政府官方網址，且都有被引用', () => {
    const used = new Set<string>(SUPPLEMENT_CARDS.flatMap((c) => [...c.claims, ...c.dose, ...c.safety].flatMap((x) => x.sources)));
    for (const [id, s] of Object.entries(SOURCES) as Array<[string, (typeof SOURCES)[keyof typeof SOURCES]]>) {
      expect(s.url, id).toMatch(/^https:\/\//);
      const pmid = 'pmid' in s ? s.pmid : undefined;
      const doi = 'doi' in s ? s.doi : undefined;
      if (s.kind === 'government') expect(s.url, id).toMatch(/\.gov\.tw\//);
      else expect(pmid ?? doi, `${id} 缺 PMID／DOI`).toBeTruthy();
      if (pmid) expect(pmid, id).toMatch(/^\d{6,9}$/);
      if (doi) expect(doi, id).toMatch(/^10\.\d{4,9}\//);
      expect(used.has(id), `${id} 沒有被任何宣稱引用`).toBe(true);
    }
  });

  it('有非醫療聲明', () => {
    expect(SUPPLEMENT_DISCLAIMER).toMatch(/不是醫療建議/);
  });
});
