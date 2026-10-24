// 轉換產物的標準答案：數值由開發者於 2026-10-24 從衛福部「食品營養成分資料庫(新版)」線上查詢頁
// （consumer.fda.gov.tw/Food/tfndDetail.aspx）手動抄錄，每 100 g、熱量為修正熱量。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const file = JSON.parse(readFileSync(new URL('../../public/data/foods-tfda.json', import.meta.url), 'utf8')) as {
  fields: string[];
  rows: Array<Array<string | number | null>>;
  license: string;
};
const get = (name: string) => {
  const r = file.rows.find((x) => x[1] === name);
  return r ? Object.fromEntries(file.fields.map((k, i) => [k, r[i]])) : undefined;
};

describe('foods-tfda.json 對照線上查詢', () => {
  it.each([
    ['去皮清肉(肉雞)', { kcal: 117, protein: 23.3, fat: 1.9, carbs: 0.6, fiber: null, sodium: 33 }],
    ['白飯', { kcal: 182, protein: 3.1, fat: 0.3, carbs: 41, fiber: 0.6, sodium: 2 }],
    ['紅肉甘藷', { kcal: 109, protein: 1.8, fat: 0.2, carbs: 25.4, fiber: 2.4, sodium: 42 }],
  ])('%s', (name, expected) => {
    expect(get(name)).toMatchObject(expected);
  });
  it('筆數與授權資訊', () => {
    expect(file.rows.length).toBeGreaterThan(2000);
    expect(file.license).toContain('政府資料開放授權條款');
  });
  it('沒有缺必要欄位的列', () => {
    const idx = ['kcal', 'protein', 'fat', 'carbs'].map((k) => file.fields.indexOf(k));
    expect(file.rows.filter((r) => idx.some((i) => r[i] == null))).toHaveLength(0);
  });
});
