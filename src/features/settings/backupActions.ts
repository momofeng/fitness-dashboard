// 匯出備份並分享／下載（首頁與資料頁共用）。
// 匯出後立刻用匯入的同一套驗證檢查一次：任何「存得進去、卻還原不了」的資料在這裡就會被發現，
// 而不是等到換手機還原時。檢查不過照樣給檔案（資料不會遺失），但不更新「上次備份」，並告訴使用者是哪一筆。

import { backupFileName, exportBackup } from '../../db/backup/backup';
import type { ParseResult } from '../../db/backup/import';
import { fieldLabel } from '../../db/backup/messages';
import { BACKUP_SPECS } from '../../db/backup/tables';
import { db } from '../../db/db';
import { updateSettings } from '../../db/repo/settings';
import { shareOrDownload } from '../../lib/platform';
import { toast } from '../../ui/toast';

function describeProblem(r: Extract<ParseResult, { ok: false }>): string {
  const i = r.issues[0];
  if (!i) return r.errors[0] ?? '未知錯誤';
  const label = BACKUP_SPECS[i.table as keyof typeof BACKUP_SPECS]?.label ?? i.table;
  return `${label}第 ${i.index + 1} 筆的「${fieldLabel(i.path)}」${i.message}${r.issues.length > 1 ? `（共 ${r.issues.length} 處）` : ''}`;
}

function warnInvalid(r: Extract<ParseResult, { ok: false }>) {
  toast(`備份檔已存下，但有資料還原時會被拒絕：${describeProblem(r)}。請修正這筆資料後再備份一次。`, { tone: 'error', ms: 12000 });
}

export async function exportAndShare(): Promise<boolean> {
  const backup = await exportBackup(db, __APP_VERSION__);
  const text = JSON.stringify(backup);
  const { parseBackup } = await import('../../db/backup/import');
  const check = parseBackup(text);
  const blob = new Blob([text], { type: 'application/json' });
  const how = await shareOrDownload(blob, backupFileName(), '增肌日誌備份');
  if (how === 'cancelled') return false;
  if (!check.ok) {
    warnInvalid(check);
    return false;
  }
  await updateSettings({ backup: { lastExportAt: Date.now() } });
  return true;
}

/** ZIP 完整備份（含進度照原圖）；回傳照片張數，取消或驗證不過時回傳 null */
export async function exportZipAndShare(): Promise<number | null> {
  const { exportZip, parseZip, zipFileName } = await import('../../db/backup/zip');
  const { blob, photos } = await exportZip(db, __APP_VERSION__);
  const check = parseZip(new Uint8Array(await blob.arrayBuffer()));
  const how = await shareOrDownload(blob, zipFileName(), '增肌日誌完整備份');
  if (how === 'cancelled') return null;
  if (!check.ok) {
    warnInvalid(check);
    return null;
  }
  const now = Date.now();
  await updateSettings({ backup: { lastExportAt: now, lastFullExportAt: now } });
  return photos;
}
