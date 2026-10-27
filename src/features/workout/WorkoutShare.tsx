import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_REPORT_OPTIONS, reportSections, reportText, selectedReport } from '../../core/training/report';
import { db } from '../../db/db';
import { useExerciseLookup } from '../../db/repo/exercises';
import { useSettings } from '../../db/repo/settings';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';

export function WorkoutShare({ workoutId, date }: { workoutId?: string; date?: string }) {
  const settings = useSettings();
  const { get } = useExerciseLookup();
  const workout = useLiveQuery(() => workoutId ? db.workouts.get(workoutId) : undefined, [workoutId]);
  const day = date ?? workout?.date;
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState(DEFAULT_REPORT_OPTIONS);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [images, setImages] = useState<Blob[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [imageError, setImageError] = useState(false);
  const [sharing, setSharing] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const data = useLiveQuery(async () => {
    if (!day || !open) return null;
    const workouts = (await db.workouts.where('date').equals(day).toArray()).filter((w) => w.status === 'done');
    const ids = new Set(workouts.map((w) => w.id));
    return { workouts, sets: (await db.sets.where('date').equals(day).toArray()).filter((s) => ids.has(s.workoutId)), cardio: await db.cardio.where('date').equals(day).toArray() };
  }, [day, open]);
  const sections = data ? reportSections(data.workouts, data.sets, data.cardio, (id) => get(id)?.nameZh ?? id, settings?.units.weight ?? 'kg', options) : [];
  const selected = selectedReport(day ?? '', sections, excluded);
  const text = reportText(selected);
  useEffect(() => {
    if (!open || !data) return;
    let cancelled = false;
    setImages([]); setImageError(false);
    void import('../../lib/workoutReportImage').then((m) => m.reportImages(selected)).then((blobs) => { if (!cancelled) setImages(blobs); }).catch(() => { if (!cancelled) setImageError(true); });
    return () => { cancelled = true; };
  }, [open, text, !!data]);
  useEffect(() => {
    const next = images.map((b) => URL.createObjectURL(b));
    setUrls(next); return () => next.forEach((url) => URL.revokeObjectURL(url));
  }, [images]);
  return <>
    <Button block size="lg" disabled={!day} onClick={() => { setExcluded([]); setOpen(true); }}>分享當日紀錄</Button>
    <Sheet open={open} onClose={() => setOpen(false)} title="分享當日紀錄" footer={<div className="flex gap-2">
      <Button block onClick={async () => { try { if (!navigator.clipboard) throw new Error(); await navigator.clipboard.writeText(text); toast('已複製，可貼到 LINE'); }
        catch { textRef.current?.focus(); textRef.current?.select(); toast('請長按下方文字，選取後複製'); } }}>複製文字</Button>
      <Button block variant="primary" disabled={!images.length || sharing} onClick={async () => { setSharing(true); try { const { shareReportImages } = await import('../../lib/workoutReportImage'); const result = await shareReportImages(images, day!); if (result === 'downloaded') toast('已下載圖片' + (images.length > 1 ? '壓縮檔' : '')); } catch { toast('分享失敗，請重試或複製文字', { tone: 'error' }); } finally { setSharing(false); } }}>{sharing ? '分享中…' : images.length ? '分享圖片（' + images.length + ' 張）' : '產生圖片中…'}</Button>
    </div>}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-chalk-3">{day} · 當日所有已完成場次與有氧；由你選擇 LINE 收件人。</p>
        <div className="flex flex-wrap gap-3">{([['context', '器械設定'], ['observations', '狀態與逐組備註'], ['notes', '給教練／有氧備註']] as const).map(([key, label]) => <label className="flex min-h-11 items-center gap-2 text-sm" key={key}><input type="checkbox" checked={options[key]} onChange={(e) => setOptions({ ...options, [key]: e.target.checked })} />{label}</label>)}</div>
        <details><summary className="press min-h-11 cursor-pointer py-2">選擇要分享的動作與場次</summary>
          <div className="flex flex-col">{sections.map((s) => <label className="flex min-h-11 items-center gap-2 text-sm" key={s.id}><input type="checkbox" checked={!excluded.includes(s.id)} onChange={(e) => setExcluded(e.target.checked ? excluded.filter((v) => v !== s.id) : [...excluded, s.id])} />{s.title}</label>)}</div>
        </details>
        {!data && <p aria-busy="true">整理紀錄中…</p>}
        <textarea ref={textRef} aria-label="當日分享文字" className="field min-h-80 resize-y py-3 text-sm leading-relaxed" value={text} readOnly />
        {imageError && <p className="text-sm text-warn">圖片產生失敗，仍可複製完整文字。</p>}
        {urls.length > 0 && <details><summary className="press min-h-11 cursor-pointer py-2">預覽分享圖片（{urls.length} 張）</summary><div className="flex flex-col gap-3">{urls.map((url, i) => <img src={url} key={url} alt={'分享圖片第 ' + (i + 1) + ' 張'} className="w-full rounded-md" />)}</div></details>}
        <p className="text-sm text-chalk-3">這是訓練摘要。換手機或清除瀏覽器前，請另外匯出完整備份。</p>
      </div>
    </Sheet>
  </>;
}
