import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { addDays, relativeDayLabel, shortDateLabel } from '../../core/dates';
import { sumNutrients } from '../../core/nutrition';
import { fmt } from '../../core/units';
import { db } from '../../db/db';
import { setIntakeComplete } from '../../db/repo/recovery';
import { addWater, copyLogs, deleteFoodLog, moveFoodLog, quickAdd, restoreFoodLogs, saveMealAsTemplate, updateFoodLogQty, useDailyLog, useFoodLogs } from '../../db/repo/foods';
import { MEAL_LABEL, MEALS, type FoodLog, type Meal } from '../../db/schemas';
import { Button, IconButton } from '../../ui/Button';
import { Field, NumberInput, Segmented, TextField } from '../../ui/Fields';
import { Icon } from '../../ui/Icon';
import { EmptyState, Meter, PageHeader } from '../../ui/Layout';
import { Sheet } from '../../ui/Sheet';
import { isValidDay } from '../../db/limits';
import { toast, toastUndo } from '../../ui/toast';
import { useTargets } from '../shared/useToday';
import { KcalHero, MacroBars } from './MacroSummary';

/** 依時段猜現在要記哪一餐 */
export function guessMeal(hour = new Date().getHours(), cutoffHour = 4): Meal {
  if (hour < cutoffHour) return 'snack';
  if (hour < 10) return 'breakfast';
  if (hour < 14) return 'lunch';
  if (hour < 17) return 'snack';
  if (hour < 21) return 'dinner';
  return 'snack';
}

export default function NutritionDay() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { targets, settings, today } = useTargets();
  const rawDate = params.get('date');
  const date = isValidDay(rawDate) && rawDate <= today ? rawDate : today;
  const logs = useFoodLogs(date);
  const daily = useDailyLog(date);
  const [entry, setEntry] = useState<FoodLog | null>(null);
  const [quick, setQuick] = useState<Meal | null>(null);
  const [mealMenu, setMealMenu] = useState<Meal | null>(null);

  if (!settings || logs === undefined) return null;
  const total = sumNutrients(logs);
  const setDate = (d: string) => setParams(d === today ? {} : { date: d }, { replace: true });
  const waterTarget = settings.nutrition.waterTargetMl;
  const water = daily?.waterMl ?? 0;
  const visibleMeals = MEALS.filter((m) => ['breakfast', 'lunch', 'dinner', 'snack'].includes(m) || logs.some((l) => l.meal === m));

  return (
    <div className="flex flex-col gap-5 pb-4">
      <PageHeader
        title="飲食"
        actions={
          <Link to="/eat/week" className="press flex h-10 items-center gap-1 rounded-md px-2 text-sm text-chalk-3 hover:bg-iron-2">
            每週
            <Icon name="chevronRight" size={16} />
          </Link>
        }
      />

      <div className="flex items-center justify-between gap-2">
        <IconButton icon="chevronLeft" label="前一天" onClick={() => setDate(addDays(date, -1))} />
        <button type="button" className="press min-w-0 flex-1 truncate rounded-md py-2 text-center font-semibold" onClick={() => setDate(today)}>
          {relativeDayLabel(date, today)}
          {date !== today && <span className="ml-2 text-sm font-normal text-chalk-3">{shortDateLabel(date)}</span>}
        </button>
        <IconButton icon="chevronRight" label="後一天" onClick={() => setDate(addDays(date, 1))} disabled={date >= today} />
      </div>

      {targets ? (
        <div className="card flex flex-col gap-5 p-5">
          <KcalHero eaten={total.kcal} target={targets.kcal} />
          <MacroBars total={total} targets={targets} />
        </div>
      ) : (
        <p className="card p-4 text-sm text-chalk-3">記錄體重後就能算出每日目標。</p>
      )}

      <div className="card flex items-center gap-3 p-4">
        <Icon name="drop" className="shrink-0 text-carbs" />
        <div className="min-w-0 flex-1">
          <p className="num text-base">
            <span className="font-semibold">{fmt(water / 1000, 2)}</span>
            <span className="text-chalk-3"> / {fmt(waterTarget / 1000, 1)} L</span>
          </p>
          <Meter value={water} max={waterTarget} label="喝水" height={4} color="var(--carbs)" />
        </div>
        <Button size="sm" onClick={() => void addWater(date, 250)}>
          +250
        </Button>
        <Button size="sm" onClick={() => void addWater(date, 500)}>
          +500
        </Button>
        {water > 0 && <IconButton icon="minus" label="減少 250 ml" size={36} onClick={() => void addWater(date, -250)} />}
      </div>

      {visibleMeals.map((meal) => {
        const items = logs.filter((l) => l.meal === meal);
        const sub = sumNutrients(items);
        return (
          <section key={meal} className="card overflow-hidden" aria-label={MEAL_LABEL[meal]}>
            <div className="flex items-center gap-2 py-2 pr-2 pl-4">
              <h2 className="font-semibold">{MEAL_LABEL[meal]}</h2>
              {items.length > 0 && (
                <span className="num text-sm text-chalk-3">
                  {fmt(sub.kcal, 0)} kcal · 蛋白質 {fmt(sub.protein, 0)} g
                </span>
              )}
              <span className="flex-1" />
              <IconButton icon="more" label={`${MEAL_LABEL[meal]}選項`} size={40} onClick={() => setMealMenu(meal)} />
              <IconButton icon="plus" label={`新增${MEAL_LABEL[meal]}`} size={40} onClick={() => navigate(`/eat/add?meal=${meal}&date=${date}`)} />
            </div>
            {items.length > 0 && (
              <ul className="divide-y divide-seam border-t border-seam">
                {items.map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => setEntry(l)} className="press flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-iron-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{l.name}</span>
                        <span className="num block text-sm text-chalk-3">
                          {l.source === 'quick' ? '快速加入' : l.unit === 'g' ? `${fmt(l.qty, 0)} g` : `${fmt(l.qty, 2)} 份`}
                        </span>
                      </span>
                      <span className="num shrink-0 text-right text-sm">
                        <span className="block font-semibold">{fmt(l.kcal, 0)}</span>
                        <span className="block text-cap text-chalk-3">P {fmt(l.protein, 0)} · C {fmt(l.carbs, 0)} · F {fmt(l.fat, 0)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <div className="grid grid-cols-2 gap-2">
        <Button icon="flame" onClick={() => setQuick(guessMeal(undefined, settings.dayCutoffHour))}>
          快速加入熱量
        </Button>
        <Button
          icon="copy"
          onClick={async () => {
            const before = logs.map((l) => l.id);
            const n = await copyLogs(addDays(date, -1), date);
            if (n === 0) toast('前一天沒有紀錄');
            else
              toastUndo(`已複製前一天的 ${n} 筆`, async () => {
                const now = await db.foodLogs.where('date').equals(date).toArray();
                await db.foodLogs.bulkDelete(now.filter((x) => !before.includes(x.id)).map((x) => x.id));
              });
          }}
        >
          複製前一天
        </Button>
      </div>
      {logs.length === 0 && <EmptyState icon="bowl" title="這天還沒有紀錄" body="點各餐右邊的 ＋ 搜尋食物，或用快速加入記下外食的熱量。" />}

      {logs.length > 0 && (
        <div className="flex flex-col gap-2 px-1">
          <p className="text-sm text-chalk-3">這天的飲食都記了嗎？自適應 TDEE 只用記錄完整的日子；「自動判斷」是熱量達目標 70% 以上就算完整。</p>
          <Segmented
            size="sm"
            ariaLabel="這天的飲食記錄"
            value={daily?.intakeComplete === true ? 'yes' : daily?.intakeComplete === false ? 'no' : 'auto'}
            options={[
              { value: 'auto', label: '自動判斷' },
              { value: 'yes', label: '完整' },
              { value: 'no', label: '不完整' },
            ]}
            onChange={(v) => void setIntakeComplete(date, v === 'auto' ? undefined : v === 'yes')}
          />
        </div>
      )}

      <EntrySheet entry={entry} onClose={() => setEntry(null)} />
      {quick && <QuickAddSheet meal={quick} date={date} onClose={() => setQuick(null)} />}
      {mealMenu && <MealMenu meal={mealMenu} date={date} onClose={() => setMealMenu(null)} onQuick={() => {
        setQuick(mealMenu);
        setMealMenu(null);
      }} />}
    </div>
  );
}

function EntrySheet({ entry, onClose }: { entry: FoodLog | null; onClose: () => void }) {
  const [qty, setQty] = useState<number | null>(null);
  // 換成另一筆時清掉沒儲存的份量，避免寫到別筆
  useEffect(() => setQty(null), [entry?.id]);
  const cur = qty ?? entry?.qty ?? null;
  const ratio = entry && cur ? cur / entry.qty : 1;
  return (
    <Sheet open={!!entry} onClose={() => { setQty(null); onClose(); }} title={entry?.name ?? ''}>
      {entry && (
        <div className="flex flex-col gap-4">
          {entry.source !== 'quick' && (
            <Field label={entry.unit === 'g' ? '份量（g）' : '份數'}>
              <NumberInput ariaLabel="份量" value={cur} step={entry.unit === 'g' ? 10 : 0.5} decimals={entry.unit === 'g' ? 0 : 2} min={0} max={5000} stepper onChange={setQty} />
            </Field>
          )}
          <div className="num grid grid-cols-4 gap-2 rounded-md bg-well p-3 text-center">
            {[
              ['熱量', entry.kcal * ratio, ''],
              ['蛋白質', entry.protein * ratio, 'g'],
              ['碳水', entry.carbs * ratio, 'g'],
              ['脂肪', entry.fat * ratio, 'g'],
            ].map(([l, v, u]) => (
              <div key={l as string}>
                <p className="text-cap text-chalk-3">{l}</p>
                <p className="font-semibold">
                  {fmt(v as number, 0)}
                  <span className="text-cap text-chalk-3">{u}</span>
                </p>
              </div>
            ))}
          </div>
          <Field label="移到">
            <div className="flex flex-wrap gap-1.5">
              {MEALS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={entry.meal === m}
                  onClick={async () => {
                    await moveFoodLog(entry.id, m);
                    onClose();
                  }}
                  className={`press h-9 rounded-full border px-3 text-sm ${entry.meal === m ? 'border-chalk bg-chalk text-on-chalk' : 'border-seam text-chalk-2'}`}
                >
                  {MEAL_LABEL[m]}
                </button>
              ))}
            </div>
          </Field>
          <div className="flex gap-2">
            <Button
              variant="danger"
              icon="trash"
              onClick={async () => {
                const removed = await deleteFoodLog(entry.id);
                setQty(null);
                onClose();
                if (removed) toastUndo(`已刪除「${removed.name}」`, () => restoreFoodLogs([removed]));
              }}
            >
              刪除
            </Button>
            {entry.source !== 'quick' && (
              <Button
                variant="primary"
                block
                className="flex-1"
                disabled={!cur || cur === entry.qty}
                onClick={async () => {
                  if (cur) await updateFoodLogQty(entry.id, cur);
                  setQty(null);
                  onClose();
                }}
              >
                儲存份量
              </Button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}

export function QuickAddSheet({ meal: initialMeal, date, onClose }: { meal: Meal; date: string; onClose: () => void }) {
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState<number | null>(null);
  const [p, setP] = useState<number | null>(null);
  const [f, setF] = useState<number | null>(null);
  const [c, setC] = useState<number | null>(null);
  const macroKcal = (p ?? 0) * 4 + (c ?? 0) * 4 + (f ?? 0) * 9;
  const effectiveKcal = kcal ?? (macroKcal > 0 ? Math.round(macroKcal) : null);
  return (
    <Sheet
      open
      onClose={onClose}
      title="快速加入"
      footer={
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!effectiveKcal}
          onClick={async () => {
            await quickAdd({ date, meal, name, kcal: effectiveKcal ?? 0, protein: p ?? 0, fat: f ?? 0, carbs: c ?? 0 });
            onClose();
          }}
        >
          加入{MEAL_LABEL[meal]}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="名稱（選填）" value={name} maxLength={80} placeholder="例如：雞腿便當" onChange={(e) => setName(e.target.value)} />
        <Field label="熱量" hint={kcal == null && macroKcal > 0 ? `未填時依巨量估算 ${Math.round(macroKcal)} kcal` : '只知道熱量也可以，蛋白質能填最好'}>
          <NumberInput ariaLabel="熱量" value={kcal} decimals={0} min={0} max={10000} suffix="kcal" onChange={setKcal} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="蛋白質">
            <NumberInput ariaLabel="蛋白質" value={p} decimals={1} min={0} max={1000} suffix="g" onChange={setP} />
          </Field>
          <Field label="碳水">
            <NumberInput ariaLabel="碳水" value={c} decimals={1} min={0} max={1000} suffix="g" onChange={setC} />
          </Field>
          <Field label="脂肪">
            <NumberInput ariaLabel="脂肪" value={f} decimals={1} min={0} max={1000} suffix="g" onChange={setF} />
          </Field>
        </div>
        <Field label="餐次">
          <div className="flex flex-wrap gap-1.5">
            {MEALS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={meal === m}
                onClick={() => setMeal(m)}
                className={`press h-9 rounded-full border px-3 text-sm ${meal === m ? 'border-chalk bg-chalk text-on-chalk' : 'border-seam text-chalk-2'}`}
              >
                {MEAL_LABEL[m]}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Sheet>
  );
}

function MealMenu({ meal, date, onClose, onQuick }: { meal: Meal; date: string; onClose: () => void; onQuick: () => void }) {
  const [name, setName] = useState(MEAL_LABEL[meal]);
  const [saving, setSaving] = useState(false);
  return (
    <Sheet open onClose={onClose} title={MEAL_LABEL[meal]}>
      <div className="flex flex-col gap-3">
        <Button icon="flame" block onClick={onQuick}>
          快速加入熱量
        </Button>
        <Button
          icon="copy"
          block
          onClick={async () => {
            const n = await copyLogs(addDays(date, -1), date, meal);
            toast(n ? `已複製前一天${MEAL_LABEL[meal]} ${n} 筆` : `前一天的${MEAL_LABEL[meal]}沒有紀錄`);
            onClose();
          }}
        >
          複製前一天的{MEAL_LABEL[meal]}
        </Button>
        <div className="flex flex-col gap-2 rounded-md bg-well p-3">
          <TextField label="存成餐點組合，下次一鍵加入" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              const t = await saveMealAsTemplate(date, meal, name);
              setSaving(false);
              toast(t ? `已存成「${t.name}」` : '這一餐還沒有紀錄');
              onClose();
            }}
          >
            存成組合
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
