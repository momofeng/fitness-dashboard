// 進度照：photos（中繼資料＋縮圖 data URL）與 photoBlobs（原圖）一起寫、一起刪。

import { useLiveQuery } from 'dexie-react-hooks';
import { PHOTO_POSES, type PhotoPose } from '../../content/types';
import { db, newId } from '../db';
import { assertDay, inRange, isValidDay, PHOTO } from '../limits';
import type { Photo } from '../schemas';

export interface NewPhoto {
  date: string;
  pose: PhotoPose;
  note: string;
  width: number;
  height: number;
  thumb: string;
  blob: Blob;
}

export function validatePhoto(p: Omit<NewPhoto, 'blob'> & { bytes: number }): string | null {
  if (!isValidDay(p.date)) return '拍攝日期格式不正確';
  if (!PHOTO_POSES.includes(p.pose)) return '未知的姿勢';
  if (p.note.length > 200) return '備註最多 200 字';
  if (!Number.isInteger(p.width) || !Number.isInteger(p.height) || !inRange('photoPx', p.width) || !inRange('photoPx', p.height)) return '照片尺寸不正確';
  if (!inRange('photoBytes', p.bytes)) return '照片檔案過大';
  if (!p.thumb.startsWith('data:image/jpeg;base64,') || p.thumb.length > PHOTO.thumbMaxChars) return '縮圖格式不正確';
  return null;
}

export async function addPhoto(input: NewPhoto): Promise<Photo> {
  const err = validatePhoto({ ...input, bytes: input.blob.size });
  if (err) throw new RangeError(err);
  const now = Date.now();
  const row: Photo = {
    id: newId(),
    date: input.date,
    pose: input.pose,
    note: input.note.trim(),
    width: input.width,
    height: input.height,
    bytes: input.blob.size,
    thumb: input.thumb,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction('rw', db.photos, db.photoBlobs, async () => {
    await db.photos.put(row);
    await db.photoBlobs.put({ id: row.id, blob: input.blob });
  });
  return row;
}

export async function updatePhotoMeta(id: string, patch: Partial<Pick<Photo, 'date' | 'pose' | 'note'>>) {
  if (patch.date !== undefined) assertDay(patch.date, '拍攝日期');
  if (patch.note != null && patch.note.length > 200) throw new RangeError('備註最多 200 字');
  if (patch.pose != null && !PHOTO_POSES.includes(patch.pose)) throw new RangeError('未知的姿勢');
  await db.photos.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deletePhoto(id: string): Promise<{ photo: Photo; blob: Blob | undefined } | null> {
  return db.transaction('rw', db.photos, db.photoBlobs, async () => {
    const photo = await db.photos.get(id);
    if (!photo) return null;
    const blob = (await db.photoBlobs.get(id))?.blob;
    await db.photos.delete(id);
    await db.photoBlobs.delete(id);
    return { photo, blob };
  });
}

export async function restorePhoto(data: { photo: Photo; blob: Blob | undefined }) {
  await db.transaction('rw', db.photos, db.photoBlobs, async () => {
    await db.photos.put(data.photo);
    if (data.blob) await db.photoBlobs.put({ id: data.photo.id, blob: data.blob });
  });
}

export async function getPhotoBlob(id: string): Promise<Blob | undefined> {
  return (await db.photoBlobs.get(id))?.blob;
}

export function usePhotos(): Photo[] | undefined {
  return useLiveQuery(async () => (await db.photos.orderBy('date').reverse().toArray()).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt), []);
}
