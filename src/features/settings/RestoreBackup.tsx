import { useRef, useState } from 'react';
import { applyBackup, backupFileName, exportBackup, type ImportMode } from '../../db/backup/backup';
import type { ParseResult } from '../../db/backup/import';
import { BACKUP_SPECS, BACKUP_TABLES } from '../../db/backup/tables';
import { db } from '../../db/db';
import { download } from '../../lib/platform';
import { Button, type ButtonProps } from '../../ui/Button';
import { Segmented } from '../../ui/Fields';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';

/** 從備份檔還原：選檔（JSON 或 ZIP）→ 驗證 → 預覽 → （有資料時先自動備份）→ 寫入 */
export function RestoreBackup({ label = '從備份檔還原', buttonProps, onDone }: { label?: string; buttonProps?: ButtonProps; onDone?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [blobs, setBlobs] = useState<Map<string, Blob>>(new Map());
  const [mode, setMode] = useState<ImportMode>('replace');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setReading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      // ZIP 以檔頭判斷（PK\x03\x04），不看副檔名
      if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
        const { parseZip } = await import('../../db/backup/zip');
        const r = parseZip(bytes);
        setBlobs(r.ok ? r.blobs : new Map());
        setParsed(r);
        return;
      }
      // 驗證程式（Zod）只在真的要匯入時才載入
      const { parseBackup } = await import('../../db/backup/import');
      setBlobs(new Map());
      setParsed(parseBackup(new TextDecoder().decode(bytes), file.size));
    } finally {
      setReading(false);
    }
  }

  async function doImport() {
    if (!parsed?.ok) return;
    setBusy(true);
    try {
      // 匯入前先自動匯出一份目前的資料，萬一選錯檔案還能救回
      const current = await exportBackup(db, __APP_VERSION__);
      const hasData = BACKUP_TABLES.some((t) => t !== 'settings' && current.tables[t].length > 0);
      const photoCount = await db.photos.count();
      if (parsed.data.includesPhotos && photoCount > 0) {
        // ZIP 還原會動到照片：先存一份含照片的 ZIP
        const { exportZip, zipFileName } = await import('../../db/backup/zip');
        const { blob } = await exportZip(db, __APP_VERSION__);
        download(blob, zipFileName().replace('fitness-full', 'fitness-before-import'));
      } else if (hasData) {
        // 直接下載到「下載」資料夾，不走分享面板，避免使用者關掉面板後仍執行取代
        download(new Blob([JSON.stringify(current)], { type: 'application/json' }), backupFileName().replace('fitness-backup', 'fitness-before-import'));
      }
      await applyBackup(db, parsed.data, mode, blobs);
      setParsed(null);
      toast(mode === 'replace' ? '已用備份取代目前資料' : '已合併備份資料');
      onDone?.();
    } catch (e) {
      toast(`匯入失敗，資料沒有變動：${e instanceof Error ? e.message : e}`, { tone: 'error', ms: 8000 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button icon="upload" block disabled={reading} {...buttonProps} onClick={() => fileRef.current?.click()}>
        {reading ? '讀取中…' : label}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json,application/zip,.zip"
        className="hidden"
        aria-label="選擇備份檔"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <Sheet
        open={parsed != null}
        onClose={() => setParsed(null)}
        title={parsed?.ok ? '確認還原' : '無法匯入'}
        footer={
          parsed?.ok ? (
            <div className="flex gap-2">
              <Button block onClick={() => setParsed(null)}>
                取消
              </Button>
              <Button variant="primary" block disabled={busy} onClick={doImport}>
                {busy ? '處理中…' : mode === 'replace' ? '取代並還原' : '合併'}
              </Button>
            </div>
          ) : undefined
        }
      >
        {parsed?.ok ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-chalk-3">
              備份時間：{parsed.data.exportedAt ? new Date(parsed.data.exportedAt).toLocaleString('zh-TW') : '未知'}
              {parsed.migratedFrom && `（舊版 v${parsed.migratedFrom}，已轉換）`}
            </p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
              {BACKUP_TABLES.filter((t) => parsed.counts[t] > 0).map((t) => (
                <li key={t} className="flex justify-between text-sm">
                  <span className="text-chalk-2">{BACKUP_SPECS[t].label}</span>
                  <span className="num">{parsed.counts[t]} 筆</span>
                </li>
              ))}
            </ul>
            <Segmented
              ariaLabel="匯入方式"
              value={mode}
              options={[
                { value: 'replace', label: '取代目前資料' },
                { value: 'merge', label: '合併（較新者優先）' },
              ]}
              onChange={setMode}
            />
            <p className="text-sm text-chalk-3">
              {parsed.data.includesPhotos
                ? `完整備份（含 ${parsed.counts.photos} 張進度照）。${mode === 'replace' ? '手機上現有的照片會被換成備份裡的。' : ''}`
                : '這份備份不含進度照，手機上現有的照片會保留。'}
            </p>
            <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
              {mode === 'replace' ? '目前的資料會被完全取代。' : '同一筆資料以較新的版本為準。'}執行前會先把目前資料下載一份到「下載」資料夾（沒有資料時略過）。
            </p>
          </div>
        ) : parsed ? (
          <div className="flex flex-col gap-3">
            {parsed.errors.map((e) => (
              <p key={e} className="text-base text-danger">
                {e}
              </p>
            ))}
            {parsed.issues.length > 0 && (
              <ul className="flex flex-col gap-1 rounded-md bg-well p-3 text-sm text-chalk-3">
                {parsed.issues.map((i, k) => (
                  <li key={k}>
                    {BACKUP_SPECS[i.table as keyof typeof BACKUP_SPECS]?.label ?? i.table} 第 {i.index + 1} 筆，{i.path}：{i.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
