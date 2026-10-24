import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, rangeKeys, shortDateLabel } from '../../core/dates';
import { sumNutrients } from '../../core/nutrition';
import { fmt } from '../../core/units';
import { db } from '../../db/db';
import { Meter, PageHeader, Section } from '../../ui/Layout';
import { useTargets } from '../shared/useToday';

export default function NutritionWeek() {
  const { targets, settings, today } = useTargets();
  const from = addDays(today, -6);
  const days = useLiveQuery(async () => {
    const logs = await db.foodLogs.where('date').between(from, today, true, true).toArray();
    return rangeKeys(from, today).map((d) => {
      const items = logs.filter((l) => l.date === d);
      return { date: d, n: items.length, total: sumNutrients(items) };
    });
  }, [from, today]);
  if (!settings || !days) return null;

  const logged = days.filter((d) => d.n > 0);
  const avg = logged.length ? sumNutrients(logged.map((d) => d.total)) : null;
  const div = Math.max(1, logged.length);
  const proteinHits = targets ? logged.filter((d) => d.total.protein >= targets.protein * 0.9).length : 0;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <PageHeader title="每週營養" back="/eat" sub={`${shortDateLabel(from)} – ${shortDateLabel(today)}`} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="有記錄的天數" value={`${logged.length} / 7`} />
        <Tile label="平均熱量" value={avg ? fmt(avg.kcal / div, 0) : '–'} unit="kcal" sub={targets ? `目標 ${targets.kcal}` : undefined} />
        <Tile label="平均蛋白質" value={avg ? fmt(avg.protein / div, 0) : '–'} unit="g" sub={targets ? `目標 ${targets.protein}` : undefined} />
        <Tile label="蛋白質達標" value={`${proteinHits} 天`} sub="達目標 90% 以上" />
      </div>

      {targets && avg && (
        <p className="rounded-md bg-well px-4 py-3 text-sm text-chalk-2">
          {avg.kcal / div < targets.kcal * 0.9
            ? '平均熱量低於目標 10% 以上，增肌期吃不夠會長不太動；可以加一份碳水（飯、麵、地瓜）或一杯牛奶。'
            : avg.kcal / div > targets.kcal * 1.15
              ? '平均熱量高於目標 15% 以上，脂肪可能增加得比較快，注意體重週增幅。'
              : '平均熱量接近目標，維持下去並觀察體重週增幅。'}
          {avg.protein / div < targets.protein * 0.9 && ' 蛋白質偏少，每餐加一份手掌大小的肉、魚、蛋或豆製品。'}
        </p>
      )}

      <Section title="每日">
        <div className="card divide-y divide-seam overflow-hidden">
          {[...days].reverse().map((d) => (
            <div key={d.date} className="flex flex-col gap-1.5 px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-chalk-2">{shortDateLabel(d.date)}</span>
                <span className="num text-sm">
                  {d.n ? (
                    <>
                      <span className="font-semibold">{fmt(d.total.kcal, 0)}</span>
                      <span className="text-chalk-3"> kcal · 蛋白質 {fmt(d.total.protein, 0)} g</span>
                    </>
                  ) : (
                    <span className="text-chalk-4">未記錄</span>
                  )}
                </span>
              </div>
              {targets && d.n > 0 && <Meter value={d.total.kcal} max={targets.kcal} label={`${d.date} 熱量`} height={4} />}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Tile({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="card flex flex-col gap-0.5 p-3">
      <span className="label">{label}</span>
      <span className="num text-h3 font-semibold">
        {value}
        {unit && <span className="ml-0.5 text-sm font-normal text-chalk-3">{unit}</span>}
      </span>
      {sub && <span className="num text-cap text-chalk-4">{sub}</span>}
    </div>
  );
}
