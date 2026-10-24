// ZIP 完整備份：backup.json（含 photos 表與縮圖）＋ photos/<id>.jpg（原圖）。
// JPEG 已經壓縮過，存成不壓縮（level 0）；JSON 用 deflate。
// 匯入：大小上限 → 只解出 backup.json 與 photos/*.jpg（其他檔案忽略，單檔大小有上限）→
// parseBackup 逐表驗證，且每張照片都要有對應、確實是 JPEG 的原圖，否則整批拒絕。

import { unzipSync, zipSync, type Unzipped, type Zippable } from 'fflate';
import type { FitnessDB } from '../db';
import { PHOTO } from '../limits';
import { BACKUP_APP_ID, MAX_BACKUP_BYTES, exportBackup } from './backup';
import { parseBackup, type ParseResult } from './import';

export const MAX_ZIP_BYTES = 400 * 1024 * 1024;
const MAX_PHOTO_FILE_BYTES = 10 * 1024 * 1024;
const MAX_UNZIPPED_BYTES = 1024 * 1024 * 1024;
const PHOTO_PATH = /^photos\/([A-Za-z0-9_-]+)\.jpg$/;

export function zipFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `fitness-full-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.zip`;
}

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export function isZip(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/** 匯出 ZIP。沒有原圖的照片（理論上不會發生）不放進備份，回傳略過的數量 */
export async function exportZip(db: FitnessDB, appVersion: string, now = Date.now()): Promise<{ blob: Blob; photos: number; skipped: number }> {
  const backup = await exportBackup(db, appVersion, now, { includePhotos: true });
  const blobs = await db.photoBlobs.toArray();
  const byId = new Map(blobs.map((b) => [b.id, b.blob]));
  const files: Zippable = {};
  const kept: unknown[] = [];
  let skipped = 0;
  for (const row of backup.tables.photos as Array<{ id: string }>) {
    const blob = byId.get(row.id);
    if (!blob) {
      skipped += 1;
      continue;
    }
    files[`photos/${row.id}.jpg`] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
    kept.push(row);
  }
  backup.tables.photos = kept;
  files['backup.json'] = [new TextEncoder().encode(JSON.stringify(backup)), { level: 6 }];
  // ZIP 的時間戳只能表示 1980–2099 年
  const mtime = new Date(Math.min(Math.max(now, Date.UTC(1980, 0, 2)), Date.UTC(2099, 11, 30)));
  const bytes = zipSync(files, { mtime });
  return { blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), photos: kept.length, skipped };
}

export type ZipParseResult = (ParseResult & { ok: true; blobs: Map<string, Blob> }) | (ParseResult & { ok: false });

export function parseZip(bytes: Uint8Array): ZipParseResult {
  const fail = (msg: string): ZipParseResult => ({ ok: false, errors: [msg], issues: [] });
  if (bytes.length > MAX_ZIP_BYTES) return fail(`檔案超過 ${MAX_ZIP_BYTES / 1024 / 1024} MB 上限。`);
  if (!isZip(bytes)) return fail('不是 ZIP 檔。');

  let files: Unzipped;
  let total = 0;
  let tooBig = '';
  try {
    files = unzipSync(bytes, {
      filter: (f) => {
        const wanted = f.name === 'backup.json' || PHOTO_PATH.test(f.name);
        if (!wanted) return false;
        const limit = f.name === 'backup.json' ? MAX_BACKUP_BYTES : MAX_PHOTO_FILE_BYTES;
        total += f.originalSize;
        if (f.originalSize > limit || total > MAX_UNZIPPED_BYTES) {
          tooBig = f.name;
          return false;
        }
        return true;
      },
    });
  } catch {
    return fail('ZIP 檔損毀，無法解壓縮。');
  }
  if (tooBig) return fail(`ZIP 內的檔案過大：${tooBig}`);
  const json = files['backup.json'];
  if (!json) return fail('ZIP 裡沒有 backup.json，這不是本 App 的完整備份。');

  const blobs = new Map<string, Blob>();
  const notJpeg: string[] = [];
  for (const [name, data] of Object.entries(files)) {
    const m = PHOTO_PATH.exec(name);
    if (!m) continue;
    if (!isJpeg(data)) {
      notJpeg.push(name);
      continue;
    }
    blobs.set(m[1]!, new Blob([data as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }));
  }
  if (notJpeg.length) return fail(`這些檔案不是 JPEG：${notJpeg.slice(0, 3).join('、')}`);

  const text = new TextDecoder().decode(json);
  const parsed = parseBackup(text, json.length, { photoIds: new Set(blobs.keys()) });
  if (!parsed.ok) return parsed;
  if (parsed.data.app !== BACKUP_APP_ID) return fail('這不是本 App 的備份檔。');
  if (!parsed.data.includesPhotos) return fail('ZIP 內的資料沒有標示含照片，請改選 JSON 備份檔。');
  // 只保留有對應資料的原圖
  const ids = new Set((parsed.data.tables.photos as Array<{ id: string }>).map((p) => p.id));
  for (const id of [...blobs.keys()]) if (!ids.has(id)) blobs.delete(id);
  for (const b of blobs.values()) if (b.size > PHOTO.inputMaxBytes) return fail('ZIP 內的照片過大。');
  return { ...parsed, blobs };
}
