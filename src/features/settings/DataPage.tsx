import { useEffect, useState } from 'react';
import { toCsv } from '../../core/csv';
import { diffDays, todayKey, toDateKey } from '../../core/dates';
import { db } from '../../db/db';
import { loadExerciseLookup } from '../../db/repo/exercises';
import { useSettings } from '../../db/repo/settings';
import { MEAL_LABEL } from '../../db/schemas';
import { persistStatus, requestPersist, shareOrDownload, storageEstimate, type PersistStatus } from '../../lib/platform';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { PageHeader, Section } from '../../ui/Layout';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { exportAndShare } from './backupActions';
import { RestoreBackup } from './RestoreBackup';

const fmtBytes = (n: number) => (n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export default function DataPage() {
  const s = useSettings();
  const [persist, setPersist] = useState<PersistStatus | null>(null);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    void persistStatus().then(setPersist);
    void storageEstimate().then(setUsage);
  }, []);

  if (!s) return null;
  const today = todayKey(s.dayCutoffHour);
  const lastDays = s.backup.lastExportAt ? diffDays(toDateKey(s.backup.lastExportAt, s.dayCutoffHour), today) : null;

  async function exportCsv(kind: 'training' | 'food' | 'body') {
    let csv = '';
    if (kind === 'training') {
      const get = await loadExerciseLookup();
      const [sets, workouts] = await Promise.all([db.sets.orderBy('date').toArray(), db.workouts.toArray()]);
      const wName = new Map(workouts.map((w) => [w.id, w.dayName]));
      const kindLabel = { warmup: '暖身', working: '正式', drop: '遞減' } as const;
      csv = toCsv(
        ['日期', '訓練', '動作', '類型', '重量(kg)', '次數', 'RIR'],
        sets.map((x) => [x.date, wName.get(x.workoutId) ?? '', get(x.exerciseId)?.nameZh ?? x.exerciseId, kindLabel[x.kind], x.weightKg, x.reps, x.rir ?? '']),
      );
    } else if (kind === 'food') {
      const logs = await db.foodLogs.orderBy('date').toArray();
      csv = toCsv(
        ['日期', '餐次', '食物', '份量', '單位', '熱量(kcal)', '蛋白質(g)', '脂肪(g)', '碳水(g)', '纖維(g)', '鈉(mg)'],
        logs.map((l) => [
          l.date,
          MEAL_LABEL[l.meal],
          l.name,
          l.qty,
          l.unit === 'g' ? 'g' : '份',
          l.kcal.toFixed(0),
          l.protein.toFixed(1),
          l.fat.toFixed(1),
          l.carbs.toFixed(1),
          l.fiber.toFixed(1),
          l.sodium.toFixed(0),
        ]),
      );
    } else {
      const rows = await db.bodyMetrics.orderBy('date').toArray();
      csv = toCsv(
        ['日期', '體重(kg)', '體脂(%)', '腰圍(cm)', '胸圍(cm)', '上臂圍(cm)', '大腿圍(cm)', '備註'],
        rows.map((r) => [r.date, r.weightKg ?? '', r.bodyFatPct ?? '', r.circ.waist ?? '', r.circ.chest ?? '', r.circ.arm ?? '', r.circ.thigh ?? '', r.note]),
      );
    }
    const name = { training: '訓練', food: '飲食', body: '身體' }[kind];
    await shareOrDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `fitness-${kind}-${today}.csv`, `增肌日誌 ${name} CSV`);
  }

  async function clearAll() {
    setBusy(true);
    try {
      await db.transaction('rw', db.tables, async () => {
        await Promise.all(db.tables.map((t) => t.clear()));
      });
      location.hash = '#/onboarding';
      location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title="資料與備份" back="/settings" />

      <div className="card flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-iron-2 text-chalk-2">
            <Icon name="download" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">備份到手機以外的地方</p>
            <p className="text-sm text-chalk-3">
              資料只存在這個瀏覽器。換手機、清除瀏覽器資料或解除安裝前，一定要先備份。
              {lastDays == null ? '你還沒有備份過。' : lastDays === 0 ? '今天已備份。' : `上次備份是 ${lastDays} 天前。`}
            </p>
          </div>
        </div>
        <Button
          variant="primary"
          icon="download"
          block
          onClick={async () => {
            if (await exportAndShare()) toast('備份完成');
          }}
        >
          匯出備份（JSON）
        </Button>
        <RestoreBackup />
      </div>

      <Section title="匯出 CSV（可用 Excel／Google 試算表開啟）">
        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" onClick={() => void exportCsv('training')}>
            訓練
          </Button>
          <Button size="sm" onClick={() => void exportCsv('food')}>
            飲食
          </Button>
          <Button size="sm" onClick={() => void exportCsv('body')}>
            身體
          </Button>
        </div>
      </Section>

      <Section title="儲存空間">
        <div className="card flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">防止瀏覽器自動清除</p>
              <p className="text-sm text-chalk-3">
                {persist === 'persisted'
                  ? '已啟用：空間不足時瀏覽器不會清掉這個 App 的資料。'
                  : persist === 'unsupported'
                    ? '這個瀏覽器不支援，請更常備份。'
                    : '尚未啟用。把 App 加到主畫面後再試，成功率較高。'}
              </p>
            </div>
            {persist === 'persisted' ? (
              <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-go">
                <Icon name="check" size={16} />
                已啟用
              </span>
            ) : (
              persist !== 'unsupported' && (
                <Button size="sm" onClick={async () => setPersist(await requestPersist())}>
                  啟用
                </Button>
              )
            )}
          </div>
          {usage && (
            <p className="num text-sm text-chalk-3">
              已使用 {fmtBytes(usage.usage)}
              {usage.quota > 0 && ` / 可用約 ${fmtBytes(usage.quota)}`}
            </p>
          )}
        </div>
      </Section>

      <Section title="危險區">
        <div className="card p-4">
          <Button variant="danger" icon="trash" block onClick={() => setConfirmClear(true)}>
            清除所有資料
          </Button>
        </div>
      </Section>

      <Sheet
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="清除所有資料？"
        footer={
          <div className="flex gap-2">
            <Button block onClick={() => setConfirmClear(false)}>
              取消
            </Button>
            <Button variant="danger" block disabled={busy} onClick={clearAll}>
              確定清除
            </Button>
          </div>
        }
      >
        <p className="text-base text-chalk-2">訓練、飲食、身體數據與設定都會刪除，無法復原。建議先匯出備份。</p>
      </Sheet>
    </div>
  );
}
