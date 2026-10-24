// 匯出備份並分享／下載（首頁與資料頁共用；JSON 備份不載入 Zod，ZIP 才載入 fflate）。

import { backupFileName, exportBackup } from '../../db/backup/backup';
import { db } from '../../db/db';
import { updateSettings } from '../../db/repo/settings';
import { shareOrDownload } from '../../lib/platform';

export async function exportAndShare(): Promise<boolean> {
  const backup = await exportBackup(db, __APP_VERSION__);
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const how = await shareOrDownload(blob, backupFileName(), '增肌日誌備份');
  if (how === 'cancelled') return false;
  await updateSettings({ backup: { lastExportAt: Date.now() } });
  return true;
}

/** ZIP 完整備份（含進度照原圖）；回傳照片張數，取消時回傳 null */
export async function exportZipAndShare(): Promise<number | null> {
  const { exportZip, zipFileName } = await import('../../db/backup/zip');
  const { blob, photos } = await exportZip(db, __APP_VERSION__);
  const how = await shareOrDownload(blob, zipFileName(), '增肌日誌完整備份');
  if (how === 'cancelled') return null;
  const now = Date.now();
  await updateSettings({ backup: { lastExportAt: now, lastFullExportAt: now } });
  return photos;
}
