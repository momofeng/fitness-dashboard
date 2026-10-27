// 進度照處理：依 EXIF 方向轉正 → 原圖長邊 1080、JPEG q0.8；縮圖長邊 240（data URL）。
// 重新編碼後不會帶 EXIF（含 GPS 位置）。

import { fitWithin } from '../core/image';
import { PHOTO } from '../db/limits';

export interface ProcessedPhoto {
  blob: Blob;
  width: number;
  height: number;
  thumb: string;
}

function canvasOf(src: ImageBitmap, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('無法處理圖片');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  return c;
}

function toJpeg(c: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('圖片編碼失敗'))), 'image/jpeg', quality));
}

/** 依 EXIF 方向轉正地讀成點陣圖；檔案太大或不是圖片時丟中文錯誤訊息 */
async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  if (file.size > PHOTO.inputMaxBytes) throw new Error(`照片超過 ${PHOTO.inputMaxBytes / 1024 / 1024} MB`);
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('無法讀取這個檔案，請選 JPEG 或 PNG 照片');
  }
}

/** 縮到長邊 longSide 的 JPEG（重新編碼後不帶 EXIF／GPS）。AI 辨識用，不存進資料庫 */
export async function resizeToJpeg(file: Blob, longSide: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await loadBitmap(file);
  try {
    const size = fitWithin(bmp.width, bmp.height, longSide);
    const blob = await toJpeg(canvasOf(bmp, size.width, size.height), quality);
    return { blob, width: size.width, height: size.height };
  } finally {
    bmp.close();
  }
}

export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  const bmp = await loadBitmap(file);
  try {
    const full = fitWithin(bmp.width, bmp.height, PHOTO.fullLongSide);
    const blob = await toJpeg(canvasOf(bmp, full.width, full.height), PHOTO.fullQuality);
    const t = fitWithin(bmp.width, bmp.height, PHOTO.thumbLongSide);
    const tc = canvasOf(bmp, t.width, t.height);
    let thumb = tc.toDataURL('image/jpeg', PHOTO.thumbQuality);
    // 很少見：細節太多時降低品質，確保縮圖在上限內
    for (let q = 0.5; thumb.length > PHOTO.thumbMaxChars && q >= 0.2; q -= 0.15) thumb = tc.toDataURL('image/jpeg', q);
    return { blob, width: full.width, height: full.height, thumb };
  } finally {
    bmp.close();
  }
}
