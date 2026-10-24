// 匯出備份並分享／下載（首頁與資料頁共用；不載入 Zod）。

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
