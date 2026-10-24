// 首頁「今日打卡」：習慣（手動的可直接打卡、自動的顯示狀態）＋使用中補給品的每日打卡與補貨提醒。

import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { needsRestock } from '../../core/products';
import { toggleHabit, useHabits } from '../../db/repo/goals';
import { setCheckIn, useConsumed, useProducts, useSupplementLogsOn } from '../../db/repo/products';
import { db } from '../../db/db';
import { Icon } from '../../ui/Icon';
import { toast } from '../../ui/toast';
import { habitDoneDates, loadDayFacts } from './facts';

export function TodayChecklist({ today, proteinTarget, waterTarget }: { today: string; proteinTarget: number | null; waterTarget: number }) {
  const habits = useHabits();
  const products = useProducts();
  const consumed = useConsumed();
  const suppLogs = useSupplementLogsOn(today);
  const data = useLiveQuery(async () => {
    const [facts, logs] = await Promise.all([loadDayFacts(today, today), db.habitLogs.where('date').equals(today).toArray()]);
    return { facts, manual: new Set(logs.map((l) => l.id)) };
  }, [today]);
  if (!habits || !products || !consumed || !suppLogs || !data) return null;
  const active = habits.filter((h) => !h.archived);
  const supps = products.filter((p) => p.kind === 'supplement' && p.status === 'using');
  if (active.length === 0 && supps.length === 0) {
    return (
      <section className="card flex flex-col gap-2 p-5" aria-label="今日打卡">
        <p className="label">今日打卡</p>
        <p className="text-sm text-chalk-3">設定想養成的習慣（量體重、蛋白質達標…）或登記在吃的補給品，就能在這裡每天打卡。</p>
        <div className="flex gap-3 text-sm">
          <Link to="/goals" className="text-chalk-2 underline decoration-chalk-4 underline-offset-2">
            設定習慣
          </Link>
          <Link to="/products" className="text-chalk-2 underline decoration-chalk-4 underline-offset-2">
            我的補給品
          </Link>
        </div>
      </section>
    );
  }
  const targets = { proteinG: proteinTarget, waterMl: waterTarget };
  const loggedToday = new Map(suppLogs.map((l) => [l.productId, l]));
  const doneCount =
    active.filter((h) => habitDoneDates(h, data.facts, data.manual, targets).has(today)).length + supps.filter((p) => loggedToday.has(p.id)).length;

  return (
    <section className="card flex flex-col gap-3 p-5" aria-label="今日打卡">
      <div className="flex items-center justify-between">
        <p className="label">今日打卡</p>
        <span className="num text-sm text-chalk-3">
          {doneCount}/{active.length + supps.length}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {active.map((h) => {
          const done = habitDoneDates(h, data.facts, data.manual, targets).has(today);
          const manual = h.rule === 'manual';
          return (
            <li key={h.id}>
              <button
                type="button"
                disabled={!manual}
                aria-pressed={done}
                aria-label={`${h.name}${manual ? '' : '（自動判定）'}`}
                onClick={() => void toggleHabit(h.id, today)}
                className="press flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left hover:bg-iron-2 disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${done ? 'bg-go text-on-chalk' : 'border border-seam-strong text-transparent'}`}>
                  <Icon name="check" size={16} strokeWidth={2.4} />
                </span>
                <span className="min-w-0 flex-1 truncate">{h.name}</span>
                {!manual && <span className="shrink-0 text-cap text-chalk-4">自動</span>}
              </button>
            </li>
          );
        })}
        {supps.map((p) => {
          const log = loggedToday.get(p.id);
          const restock = needsRestock(p, consumed.get(p.id) ?? 0);
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={!!log}
                aria-label={`補給品：${p.name}`}
                onClick={() =>
                  void setCheckIn(p.id, today, log ? null : p.dailyServings && p.dailyServings >= 0.25 ? p.dailyServings : 1).catch((e: unknown) =>
                    toast(e instanceof Error ? e.message : String(e), { tone: 'error' }),
                  )
                }
                className="press flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left hover:bg-iron-2"
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${log ? 'bg-go text-on-chalk' : 'border border-seam-strong text-transparent'}`}>
                  <Icon name="check" size={16} strokeWidth={2.4} />
                </span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {restock && <span className="shrink-0 rounded-sm bg-warn-soft px-1.5 text-cap text-warn">該補貨</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <Link to="/goals" className="flex items-center gap-0.5 self-end text-sm text-chalk-3 hover:text-chalk">
        目標與習慣
        <Icon name="chevronRight" size={16} />
      </Link>
    </section>
  );
}
