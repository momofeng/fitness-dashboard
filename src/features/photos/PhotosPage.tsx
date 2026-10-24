// 進度照：拍照或選圖 → 轉正、縮到長邊 1080 存原圖、另存 240 縮圖；依日期瀏覽、兩張並排比較。
// 照片只存在這支手機；JSON 備份不含照片，要用 ZIP 完整備份。

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { PHOTO_POSE_LABEL, PHOTO_POSES, type PhotoPose } from '../../content/types';
import { diffDays, shortDateLabel, toDateKey } from '../../core/dates';
import { fmt, toDisplayWeight } from '../../core/units';
import { db } from '../../db/db';
import { addPhoto, deletePhoto, getPhotoBlob, restorePhoto, updatePhotoMeta, usePhotos } from '../../db/repo/photos';
import type { Photo } from '../../db/schemas';
import { processPhoto, type ProcessedPhoto } from '../../lib/image';
import { Button } from '../../ui/Button';
import { Field, TextField } from '../../ui/Fields';
import { Icon } from '../../ui/Icon';
import { EmptyState, PageHeader } from '../../ui/Layout';
import { Sheet } from '../../ui/Sheet';
import { toast, toastUndo } from '../../ui/toast';
import { useTargets } from '../shared/useToday';

/** 完整備份超過幾天沒做就提醒 */
const FULL_BACKUP_REMIND_DAYS = 30;

function PoseChips({ value, onChange, allowAll = false }: { value: PhotoPose | null; onChange: (p: PhotoPose | null) => void; allowAll?: boolean }) {
  const opts: Array<PhotoPose | null> = allowAll ? [null, ...PHOTO_POSES] : [...PHOTO_POSES];
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="姿勢">
      {opts.map((p) => (
        <button
          key={p ?? 'all'}
          type="button"
          role="radio"
          aria-checked={value === p}
          onClick={() => onChange(p)}
          className={`press h-8 rounded-full border px-3 text-sm ${value === p ? 'border-chalk bg-chalk font-medium text-on-chalk' : 'border-seam text-chalk-2'}`}
        >
          {p ? PHOTO_POSE_LABEL[p] : '全部'}
        </button>
      ))}
    </div>
  );
}

export default function PhotosPage() {
  const { settings, today } = useTargets();
  const photos = usePhotos();
  const cameraRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ProcessedPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [pose, setPose] = useState<PhotoPose | null>(null);
  const [viewing, setViewing] = useState<Photo | null>(null);
  const [comparing, setComparing] = useState<Photo[] | null>(null);

  if (!settings || !photos) return null;
  const list = photos.filter((p) => !pose || p.pose === pose);
  const byDate = new Map<string, Photo[]>();
  for (const p of list) byDate.set(p.date, [...(byDate.get(p.date) ?? []), p]);
  const lastFull = settings.backup.lastFullExportAt;
  const fullDays = lastFull ? diffDays(toDateKey(lastFull, settings.dayCutoffHour), today) : null;
  const backupDue = photos.length > 0 && (fullDays == null || fullDays >= FULL_BACKUP_REMIND_DAYS);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      setPending(await processPhoto(file));
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const selecting = comparing != null;
  const onTap = (p: Photo) => {
    if (!selecting) return setViewing(p);
    const has = comparing.some((x) => x.id === p.id);
    const next = has ? comparing.filter((x) => x.id !== p.id) : [...comparing, p].slice(-2);
    setComparing(next);
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader
        title="進度照"
        back="/body"
        sub={`${photos.length} 張`}
        actions={
          photos.length >= 2 && (
            <Button size="sm" variant={selecting ? 'primary' : 'secondary'} onClick={() => setComparing(selecting ? null : [])}>
              {selecting ? '取消比較' : '比較'}
            </Button>
          )
        }
      />
      <p className="flex items-start gap-2 text-sm text-chalk-3">
        <Icon name="info" size={16} className="mt-0.5 shrink-0" />
        照片只存在這支手機，不會上傳；存檔時會去掉拍攝位置等資訊。建議每次固定光線、距離與姿勢。
      </p>
      {backupDue && (
        <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
          {fullDays == null ? '還沒有做過含照片的完整備份' : `上次完整備份是 ${fullDays} 天前`}。一般 JSON 備份不含照片，換手機前請到
          <Link to="/settings/data" className="underline underline-offset-2">
            資料與備份
          </Link>
          做 ZIP 完整備份。
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" icon="plus" disabled={busy} onClick={() => cameraRef.current?.click()}>
          {busy ? '處理中…' : '拍照'}
        </Button>
        <Button icon="upload" disabled={busy} onClick={() => pickRef.current?.click()}>
          從相簿選
        </Button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="拍進度照" onChange={(e) => (void onFile(e.target.files?.[0]), (e.target.value = ''))} />
      <input ref={pickRef} type="file" accept="image/*" className="hidden" aria-label="選擇進度照" onChange={(e) => (void onFile(e.target.files?.[0]), (e.target.value = ''))} />

      {photos.length > 0 && <PoseChips value={pose} onChange={setPose} allowAll />}
      {selecting && (
        <div className="flex items-center gap-2 rounded-md bg-well px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 text-chalk-2">點兩張照片並排比較（已選 {comparing.length}/2）</span>
        </div>
      )}

      {photos.length === 0 ? (
        <EmptyState icon="body" title="還沒有進度照" body="每 2–4 週拍一次正面、側面、背面，比體重更看得出變化。" />
      ) : (
        [...byDate].map(([date, ps]) => (
          <section key={date} className="flex flex-col gap-2" aria-label={shortDateLabel(date)}>
            <h2 className="label px-1">{shortDateLabel(date)}</h2>
            <div className="grid grid-cols-3 gap-2">
              {ps.map((p) => {
                const picked = comparing?.some((x) => x.id === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onTap(p)}
                    aria-pressed={selecting ? !!picked : undefined}
                    aria-label={`${shortDateLabel(p.date)} ${PHOTO_POSE_LABEL[p.pose]}${p.note ? `：${p.note}` : ''}`}
                    className={`press relative overflow-hidden rounded-md border bg-well ${picked ? 'border-chalk ring-2 ring-chalk' : 'border-seam'}`}
                    style={{ aspectRatio: '3 / 4' }}
                  >
                    <img src={p.thumb} alt="" className="h-full w-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 bg-floor/70 px-1.5 py-0.5 text-left text-cap text-chalk">{PHOTO_POSE_LABEL[p.pose]}</span>
                    {picked && (
                      <span className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-chalk text-on-chalk">
                        <Icon name="check" size={14} strokeWidth={2.4} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}

      {pending && <NewPhotoSheet photo={pending} today={today} onClose={() => setPending(null)} />}
      {viewing && <PhotoViewer photo={viewing} today={today} onClose={() => setViewing(null)} />}
      {comparing && comparing.length === 2 && <CompareSheet photos={comparing} unit={settings.units.weight} onClose={() => setComparing(null)} />}
    </div>
  );
}

function NewPhotoSheet({ photo, today, onClose }: { photo: ProcessedPhoto; today: string; onClose: () => void }) {
  const [date, setDate] = useState(today);
  const [pose, setPose] = useState<PhotoPose>('front');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open
      onClose={onClose}
      title="新增進度照"
      footer={
        <Button
          variant="primary"
          block
          disabled={busy || !date || date > today}
          onClick={async () => {
            setBusy(true);
            try {
              await addPhoto({ date, pose, note, width: photo.width, height: photo.height, thumb: photo.thumb, blob: photo.blob });
              toast('已儲存進度照');
              onClose();
            } catch (e) {
              toast(e instanceof Error ? e.message : String(e), { tone: 'error' });
            } finally {
              setBusy(false);
            }
          }}
        >
          儲存
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <img src={photo.thumb} alt="預覽" className="mx-auto max-h-60 rounded-md object-contain" />
        <p className="num text-center text-cap text-chalk-4">
          {photo.width}×{photo.height} · {fmt(photo.blob.size / 1024, 0)} KB
        </p>
        <Field label="姿勢">
          <PoseChips value={pose} onChange={(p) => p && setPose(p)} />
        </Field>
        <Field label="日期">
          <input type="date" className="field" value={date} max={today} onChange={(e) => setDate(e.target.value)} aria-label="拍攝日期" />
        </Field>
        <TextField label="備註（選填）" value={note} maxLength={200} placeholder="例如：早上空腹、增肌第 8 週" onChange={(e) => setNote(e.target.value)} />
      </div>
    </Sheet>
  );
}

function useBlobUrl(id: string): string | null | undefined {
  const blob = useLiveQuery(() => getPhotoBlob(id), [id]);
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (blob === undefined) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return blob === undefined ? undefined : url;
}

function PhotoViewer({ photo, today, onClose }: { photo: Photo; today: string; onClose: () => void }) {
  const url = useBlobUrl(photo.id);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(photo.date);
  const [pose, setPose] = useState<PhotoPose>(photo.pose);
  const [note, setNote] = useState(photo.note);
  const [confirm, setConfirm] = useState(false);
  return (
    <Sheet open onClose={onClose} title={`${shortDateLabel(photo.date)} · ${PHOTO_POSE_LABEL[photo.pose]}`} wide>
      <div className="flex flex-col gap-4">
        <img src={url ?? photo.thumb} alt={`${shortDateLabel(photo.date)} ${PHOTO_POSE_LABEL[photo.pose]}進度照`} className="mx-auto max-h-[60dvh] w-auto rounded-md object-contain" />
        {photo.note && !editing && <p className="text-base text-chalk-2">{photo.note}</p>}
        {editing ? (
          <div className="flex flex-col gap-3">
            <PoseChips value={pose} onChange={(p) => p && setPose(p)} />
            <input type="date" className="field" value={date} max={today} onChange={(e) => setDate(e.target.value)} aria-label="拍攝日期" />
            <TextField label="備註" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
            <Button
              variant="primary"
              disabled={!date || date > today}
              onClick={() =>
                void updatePhotoMeta(photo.id, { date, pose, note: note.trim() })
                  .then(onClose)
                  .catch((e: unknown) => toast(e instanceof Error ? e.message : String(e), { tone: 'error' }))
              }
            >
              儲存
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button icon="edit" onClick={() => setEditing(true)}>
              編輯
            </Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={async () => {
                if (!confirm) return setConfirm(true);
                const removed = await deletePhoto(photo.id);
                onClose();
                if (removed) toastUndo('已刪除照片', () => restorePhoto(removed));
              }}
            >
              {confirm ? '確定刪除' : '刪除'}
            </Button>
          </div>
        )}
        <p className="num text-cap text-chalk-4">
          {photo.width}×{photo.height} · {fmt(photo.bytes / 1024, 0)} KB
        </p>
      </div>
    </Sheet>
  );
}

function ComparePane({ photo, unit }: { photo: Photo; unit: 'kg' | 'lb' }) {
  const url = useBlobUrl(photo.id);
  // 拍照當天或之前最近一次的體重
  const weight = useLiveQuery(async () => {
    const rows = await db.bodyMetrics.where('date').belowOrEqual(photo.date).reverse().toArray();
    return rows.find((r) => r.weightKg != null)?.weightKg ?? null;
  }, [photo.date]);
  return (
    <figure className="flex min-w-0 flex-col gap-1">
      <img src={url ?? photo.thumb} alt={`${shortDateLabel(photo.date)} ${PHOTO_POSE_LABEL[photo.pose]}`} className="w-full rounded-md object-contain" />
      <figcaption className="num text-center text-sm">
        <span className="block font-medium">{shortDateLabel(photo.date)}</span>
        <span className="block text-chalk-3">
          {PHOTO_POSE_LABEL[photo.pose]}
          {weight != null && ` · ${fmt(toDisplayWeight(weight, unit), 1)} ${unit}`}
        </span>
      </figcaption>
    </figure>
  );
}

function CompareSheet({ photos, unit, onClose }: { photos: Photo[]; unit: 'kg' | 'lb'; onClose: () => void }) {
  const [a, b] = [...photos].sort((x, y) => x.date.localeCompare(y.date) || x.createdAt - y.createdAt);
  const days = diffDays(a!.date, b!.date);
  return (
    <Sheet open onClose={onClose} title={`比較：相隔 ${days} 天`} wide>
      <div className="grid grid-cols-2 gap-2">
        <ComparePane photo={a!} unit={unit} />
        <ComparePane photo={b!} unit={unit} />
      </div>
    </Sheet>
  );
}
