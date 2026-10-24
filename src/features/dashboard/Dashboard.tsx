import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router';
import { dailyAverages, movingAverage, rateVerdict, streak, weeklyRatePct } from '../../core/body';
import { addDays, diffDays, rangeKeys, shortDateLabel, toDateKey } from '../../core/dates';
import { sumNutrients } from '../../core/nutrition';
import { fmt, toDisplayWeight } from '../../core/units';
import { db } from '../../db/db';
import { useBodyMetrics } from '../../db/repo/body';
import { addWater, useDailyLog, useFoodLogs } from '../../db/repo/foods';
import { useActiveProgram } from '../../db/repo/programs';
import { useActiveWorkout } from '../../db/repo/workouts';
import { useExerciseLookup } from '../../db/repo/exercises';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Meter } from '../../ui/Layout';
import { Sparkline } from '../../ui/Sparkline';
import { toast } from '../../ui/toast';
import { KcalHero, MacroBars } from '../nutrition/MacroSummary';
import { exportAndShare } from '../settings/backupActions';
import { useTargets } from '../shared/useToday';
import { weekVolume } from '../workout/trainingStats';

function greeting(h = new Date().getHours()) {
  if (h < 5) return '夜深了';
  if (h < 11) return '早安';
  if (h < 14) return '午安';
  if (h < 18) return '下午好';
  return '晚安';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { targets, settings, today } = useTargets();
  const logs = useFoodLogs(today);
  const daily = useDailyLog(today);
  const metrics = useBodyMetrics();
  const active = useActiveWorkout();
  const program = useActiveProgram();
  const { get } = useExerciseLookup();
  const todayWorkouts = useLiveQuery(() => db.workouts.where('date').equals(today).filter((w) => w.status === 'done').toArray(), [today]);
  const week = useLiveQuery(() => (settings ? weekVolume(today, settings.weekStart) : undefined), [today, settings?.weekStart]);
  const activeDays = useLiveQuery(async () => {
    const [w, f, b] = await Promise.all([
      db.workouts.where('status').equals('done').toArray(),
      db.foodLogs.orderBy('date').uniqueKeys(),
      db.bodyMetrics.orderBy('date').uniqueKeys(),
    ]);
    return new Set<string>([...w.map((x) => x.date), ...(f as string[]), ...(b as string[])]);
  }, []);

  const recordCount = useLiveQuery(
    async () => (await db.foodLogs.count()) + (await db.workouts.count()) + (await db.bodyMetrics.count()) + (await db.cardio.count()),
    [],
  );

  if (!settings || !logs || !metrics) return <div aria-busy="true" />;
  const unit = settings.units.weight;
  const total = sumNutrients(logs);
  const water = daily?.waterMl ?? 0;

  const dailyW = dailyAverages(metrics.filter((m) => m.weightKg != null).map((m) => ({ date: m.date, value: m.weightKg! })));
  const avg7 = movingAverage(dailyW, today);
  const rate = weeklyRatePct(dailyW, today);
  const verdict = rate != null ? rateVerdict(rate, settings.nutrition.weeklyGainPct) : null;
  const spark = rangeKeys(addDays(today, -27), today).map((d) => movingAverage(dailyW, d, 7, 1));
  const weighedToday = dailyW.has(today);
  const latest = [...metrics].reverse().find((m) => m.weightKg != null);

  const lastBackup = settings.backup.lastExportAt;
  const backupDays = lastBackup ? diffDays(toDateKey(lastBackup, settings.dayCutoffHour), today) : null;
  // 只有首次設定時的那筆體重不算「有資料」
  const hasData = (recordCount ?? 0) > 1;
  const backupDue = settings.backup.remindDays > 0 && hasData && (backupDays == null || backupDays >= settings.backup.remindDays);
  const streakDays = activeDays ? streak(activeDays, today) : 0;

  const nextDay = program ? program.days[program.nextDayIndex % program.days.length] : undefined;
  const doneToday = todayWorkouts?.[0];

  return (
    <div className="flex flex-col gap-4 pt-[max(12px,env(safe-area-inset-top))] pb-4">
      <header className="flex items-end justify-between gap-3 py-2">
        <div className="min-w-0">
          <p className="text-sm text-chalk-3">{shortDateLabel(today)}</p>
          <h1 className="truncate text-h1 font-semibold">
            {greeting()}
            {settings.profile.name ? `，${settings.profile.name}` : ''}
          </h1>
        </div>
        {streakDays > 0 && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-seam px-3 py-1.5" title="連續有記錄的天數">
            <Icon name="flame" size={16} className="text-warn" />
            <span className="num text-sm font-semibold">{streakDays}</span>
            <span className="text-sm text-chalk-3">天</span>
          </div>
        )}
      </header>

      {backupDue && (
        <div className="flex items-center gap-3 rounded-lg border border-seam-strong bg-warn-soft p-3">
          <Icon name="download" className="shrink-0 text-warn" />
          <p className="min-w-0 flex-1 text-sm text-chalk">
            {backupDays == null ? '還沒有備份過' : `上次備份是 ${backupDays} 天前`}。資料只存在這支手機，建議現在備份一次。
          </p>
          <Button
            size="sm"
            variant="primary"
            onClick={async () => {
              if (await exportAndShare()) toast('備份完成');
            }}
          >
            備份
          </Button>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        {/* 訓練 */}
        <section className="card flex flex-col gap-3 p-5" aria-label="今天的訓練">
          <div className="flex items-center justify-between">
            <p className="label">訓練</p>
            {week && program && (
              <span className="num text-sm text-chalk-3">
                本週 {week.sessions}/{program.daysPerWeek} 次
              </span>
            )}
          </div>
          {active ? (
            <>
              <p className="text-h2 font-semibold">{active.dayName}進行中</p>
              <Button variant="primary" size="lg" block iconRight="chevronRight" onClick={() => navigate(`/train/session/${active.id}`)}>
                繼續訓練
              </Button>
            </>
          ) : doneToday ? (
            <>
              <p className="flex items-center gap-2 text-h2 font-semibold">
                <Icon name="check" className="text-go" />
                今天練完了
              </p>
              <p className="text-sm text-chalk-3">
                {doneToday.dayName}
                {doneToday.summary?.prs.length ? ` · ${doneToday.summary.prs.length} 項新紀錄` : ''}。記得吃夠蛋白質、睡飽。
              </p>
              <Link to={`/train/history/${doneToday.id}`} className="text-sm text-chalk-2 underline decoration-chalk-4 underline-offset-2">
                查看紀錄
              </Link>
            </>
          ) : nextDay ? (
            <>
              <div>
                <p className="text-h2 font-semibold">{nextDay.name}</p>
                <p className="truncate text-sm text-chalk-3">{nextDay.slots.map((s) => get(s.exerciseId)?.nameZh ?? '').filter(Boolean).join('、')}</p>
              </div>
              <Button variant="primary" size="lg" block icon="play" onClick={() => navigate('/train')}>
                準備開始
              </Button>
            </>
          ) : (
            <>
              <p className="text-h3 font-semibold">還沒有課表</p>
              <Button block onClick={() => navigate('/train/program')}>
                選擇課表
              </Button>
            </>
          )}
        </section>

        {/* 飲食 */}
        <section className="card flex flex-col gap-4 p-5" aria-label="今天的飲食">
          <div className="flex items-center justify-between">
            <p className="label">飲食</p>
            <Link to="/eat" className="flex items-center gap-0.5 text-sm text-chalk-3 hover:text-chalk">
              明細
              <Icon name="chevronRight" size={16} />
            </Link>
          </div>
          {targets ? (
            <>
              <KcalHero eaten={total.kcal} target={targets.kcal} size="md" />
              <MacroBars total={total} targets={targets} compact />
            </>
          ) : (
            <p className="text-sm text-chalk-3">記錄體重後就會算出每日目標。</p>
          )}
          <Button icon="plus" block onClick={() => navigate('/eat/add')}>
            記錄飲食
          </Button>
        </section>

        {/* 體重 */}
        <section className="card flex flex-col gap-3 p-5" aria-label="體重趨勢">
          <div className="flex items-center justify-between">
            <p className="label">體重</p>
            <Link to="/body" className="flex items-center gap-0.5 text-sm text-chalk-3 hover:text-chalk">
              趨勢
              <Icon name="chevronRight" size={16} />
            </Link>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="num text-h1 font-semibold">
                {avg7 != null ? fmt(toDisplayWeight(avg7, unit), 1) : latest?.weightKg != null ? fmt(toDisplayWeight(latest.weightKg, unit), 1) : '–'}
                <span className="ml-1 text-sm font-normal text-chalk-3">{unit}</span>
              </p>
              <p className="num text-sm text-chalk-3">
                {avg7 != null ? '7 日平均' : '最近一次'}
                {rate != null && ` · 週 ${rate >= 0 ? '+' : ''}${fmt(rate, 2)}%`}
              </p>
            </div>
            <Sparkline values={spark} label="近 4 週體重 7 日均線" />
          </div>
          {verdict && (
            <p className={`text-sm ${verdict.verdict === 'ok' ? 'text-go' : 'text-warn'}`}>
              {{ ok: '增重速度剛好', slow: '增重偏慢', fast: '增重偏快', losing: '體重下降中' }[verdict.verdict]}
            </p>
          )}
          {!weighedToday && (
            <Button block onClick={() => navigate('/body')}>
              記錄今天體重
            </Button>
          )}
        </section>

        {/* 喝水 */}
        <section className="card flex flex-col gap-3 p-5" aria-label="喝水">
          <p className="label">喝水</p>
          <div className="flex items-center gap-3">
            <Icon name="drop" className="shrink-0 text-carbs" />
            <p className="num min-w-0 flex-1 text-h3 font-semibold">
              {fmt(water / 1000, 2)}
              <span className="text-sm font-normal text-chalk-3"> / {fmt(settings.nutrition.waterTargetMl / 1000, 1)} L</span>
            </p>
            <Button size="sm" onClick={() => void addWater(today, 250)}>
              +250
            </Button>
            <Button size="sm" onClick={() => void addWater(today, 500)}>
              +500
            </Button>
          </div>
          <Meter value={water} max={settings.nutrition.waterTargetMl} label="喝水進度" height={4} color="var(--carbs)" />
        </section>
      </div>

      <p className="pt-2 text-center text-cap text-chalk-4">數字皆為估算，不是醫療建議。{backupDays != null && !backupDue ? ` 上次備份 ${backupDays === 0 ? '今天' : `${backupDays} 天前`}。` : ''}</p>
    </div>
  );
}
