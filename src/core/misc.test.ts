import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';
import { addDays, diffDays, isDateKey, rangeKeys, startOfWeek, toDateKey } from './dates';
import { matchScore, normalizeText, searchItems } from './search';
import { fromDisplayWeight, kgToLb, lbToKg, roundTo, toDisplayWeight } from './units';

describe('日期', () => {
  it('日切換時間：凌晨 3:59 算前一天、4:00 算當天', () => {
    expect(toDateKey(new Date(2026, 9, 24, 3, 59), 4)).toBe('2026-10-23');
    expect(toDateKey(new Date(2026, 9, 24, 4, 0), 4)).toBe('2026-10-24');
    expect(toDateKey(new Date(2026, 9, 24, 0, 30), 0)).toBe('2026-10-24');
  });
  it('加減日跨月跨年', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-10-01', '2026-10-24')).toBe(23);
  });
  it('週起始日', () => {
    // 2026-10-24 是週六
    expect(startOfWeek('2026-10-24', 1)).toBe('2026-10-19');
    expect(startOfWeek('2026-10-24', 0)).toBe('2026-10-18');
    expect(startOfWeek('2026-10-19', 1)).toBe('2026-10-19');
  });
  it('日期格式驗證', () => {
    expect(isDateKey('2026-10-24')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026/10/24')).toBe(false);
  });
  it('範圍', () => {
    expect(rangeKeys('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });
});

describe('單位', () => {
  it('kg ↔ lb 來回不漂移', () => {
    for (const kg of [0, 1.25, 20, 62.5, 142.5]) {
      expect(lbToKg(kgToLb(kg))).toBeCloseTo(kg, 9);
      expect(fromDisplayWeight(toDisplayWeight(kg, 'lb'), 'lb')).toBeCloseTo(kg, 9);
    }
  });
  it('四捨五入到級距並消掉浮點誤差', () => {
    expect(roundTo(52.4, 2.5)).toBe(52.5);
    expect(roundTo(0.1 + 0.2, 0.1)).toBe(0.3);
  });
});

describe('搜尋', () => {
  const foods = [
    { name: '雞胸肉(去皮)', aliases: ['雞胸'] },
    { name: '雞腿肉', aliases: [] },
    { name: '烤雞胸肉三明治', aliases: [] },
    { name: '白飯', aliases: ['米飯', '蓬萊米飯'] },
  ];
  it('全形與空白正規化', () => {
    expect(normalizeText('ＡＢＣ　雞 胸')).toBe('abc雞胸');
  });
  it('開頭相同排前面', () => {
    expect(searchItems(foods, '雞胸').map((f) => f.name)).toEqual(['雞胸肉(去皮)', '烤雞胸肉三明治']);
  });
  it('別名命中', () => {
    expect(searchItems(foods, '米飯').map((f) => f.name)).toEqual(['白飯']);
  });
  it('多個關鍵字都要命中', () => {
    expect(matchScore(foods[2]!, '雞胸 三明治')).toBeGreaterThan(0);
    expect(matchScore(foods[0]!, '雞胸 三明治')).toBe(0);
  });
});

describe('CSV', () => {
  it('BOM、跳脫逗號與引號', () => {
    expect(toCsv(['a', 'b'], [['x,y', 'say "hi"'], [1, null]])).toBe('﻿a,b\r\n"x,y","say ""hi"""\r\n1,\r\n');
  });
});
