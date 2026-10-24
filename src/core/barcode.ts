// 商品條碼（GTIN）：正規化與檢查碼。EAN-8、UPC-A（12 碼）、EAN-13、GTIN-14 都用同一套 mod-10 算法。

/** 全形數字轉半形，去掉空白與連字號 */
export function normalizeBarcode(raw: string): string {
  return raw.normalize('NFKC').replace(/[\s-]/g, '');
}

export type GtinKind = 'EAN-8' | 'UPC-A' | 'EAN-13' | 'GTIN-14';

export function gtinKind(code: string): GtinKind | null {
  if (!/^\d+$/.test(code)) return null;
  return ({ 8: 'EAN-8', 12: 'UPC-A', 13: 'EAN-13', 14: 'GTIN-14' } as const)[code.length as 8 | 12 | 13 | 14] ?? null;
}

/** 由前面幾碼算出最後一碼檢查碼 */
export function gtinCheckDigit(body: string): number {
  let sum = 0;
  // 從右邊數來第 1、3、5… 位（不含檢查碼）乘 3
  for (let i = 0; i < body.length; i++) {
    const d = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidGtin(code: string): boolean {
  if (!gtinKind(code)) return false;
  return gtinCheckDigit(code.slice(0, -1)) === Number(code.at(-1));
}

/** 同一個商品可能以 UPC-A（12 碼）或前面補 0 的 EAN-13 出現，查詢時兩種都找 */
export function barcodeVariants(code: string): string[] {
  const out = new Set([code]);
  if (code.length === 12) out.add(`0${code}`);
  if (code.length === 13 && code.startsWith('0')) out.add(code.slice(1));
  return [...out];
}
