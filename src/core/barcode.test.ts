import { describe, expect, it } from 'vitest';
import { barcodeVariants, gtinCheckDigit, gtinKind, isValidGtin, normalizeBarcode } from './barcode';

describe('條碼', () => {
  it('正規化：全形、空白、連字號', () => {
    expect(normalizeBarcode('４７１ 0088-012345')).toBe('4710088012345');
  });
  it.each([
    ['4710088012345', false],
    ['4006381333931', true], // EAN-13 常見範例
    ['036000291452', true], // UPC-A
    ['96385074', true], // EAN-8
    ['10012345678902', true], // GTIN-14
    ['4006381333932', false], // 檢查碼錯
    ['123', false],
    ['abc4567890123', false],
  ])('%s 有效：%s', (code, ok) => {
    expect(isValidGtin(code)).toBe(ok);
  });
  it('檢查碼與種類', () => {
    expect(gtinCheckDigit('400638133393')).toBe(1);
    expect(gtinKind('036000291452')).toBe('UPC-A');
    expect(gtinKind('12345')).toBeNull();
  });
  it('UPC-A 與補 0 的 EAN-13 互相對應', () => {
    expect(barcodeVariants('036000291452')).toEqual(['036000291452', '0036000291452']);
    expect(barcodeVariants('0036000291452')).toEqual(['0036000291452', '036000291452']);
    expect(barcodeVariants('4006381333931')).toEqual(['4006381333931']);
  });
});
