import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { searchItems } from '../../core/search';
import { fmt } from '../../core/units';
import { db } from '../../db/db';
import { addFoodLog, computeEntry, customToItem, logMealTemplate, type FoodItem } from '../../db/repo/foods';
import { MEAL_LABEL, MEALS, type Meal, type MealTemplate } from '../../db/schemas';
import { Button } from '../../ui/Button';
import { Field, NumberInput, Segmented } from '../../ui/Fields';
import { Icon } from '../../ui/Icon';
import { PageHeader } from '../../ui/Layout';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';
import { useTargets } from '../shared/useToday';
import { useTfda } from './foodSource';
import { CustomFoodForm } from './MyFoods';
import { guessMeal, QuickAddSheet } from './NutritionDay';

export default function AddFood() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { today } = useTargets();
  const date = params.get('date') ?? today;
  const [meal, setMeal] = useState<Meal>((params.get('meal') as Meal) || guessMeal());
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<FoodItem | null>(null);
  const [pickedMeal, setPickedMeal] = useState<MealTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [quick, setQuick] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { db: tfda, error } = useTfda();

  const custom = useLiveQuery(() => db.foodsCustom.toArray(), []);
  const templates = useLiveQuery(() => db.mealTemplates.toArray(), []);
  const usage = useLiveQuery(() => db.foodUsage.orderBy('lastUsedAt').reverse().limit(200).toArray(), []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const customItems = useMemo(() => (custom ?? []).map(customToItem), [custom]);
  const usageMap = useMemo(() => new Map((usage ?? []).map((u) => [u.foodKey, u])), [usage]);
  const results = useMemo(() => {
    if (!q.trim()) return [];
    const pool = [...customItems, ...(tfda?.items ?? [])];
    return searchItems(pool, q, 60, (it) => Math.min(40, (usageMap.get(it.key)?.count ?? 0) * 8) + (it.source === 'custom' ? 10 : 0));
  }, [q, customItems, tfda, usageMap]);
  const templateResults = useMemo(
    () => (templates ?? []).filter((t) => !q.trim() || t.name.includes(q.trim())),
    [templates, q],
  );

  const lookupItem = (key: string): FoodItem | undefined => (key.startsWith('custom:') ? customItems.find((c) => c.key === key) : tfda?.byKey.get(key));
  const recent = (usage ?? [])
    .filter((u) => !u.foodKey.startsWith('meal:'))
    .map((u) => ({ u, item: lookupItem(u.foodKey) }))
    .filter((x): x is { u: (typeof x)['u']; item: FoodItem } => !!x.item)
    .slice(0, 12);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader title={`加入${MEAL_LABEL[meal]}`} back={`/eat${date !== today ? `?date=${date}` : ''}`} />
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4" role="radiogroup" aria-label="餐次">
        {MEALS.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={meal === m}
            onClick={() => setMeal(m)}
            className={`press h-8 shrink-0 rounded-full border px-3 text-sm ${meal === m ? 'border-chalk bg-chalk font-medium text-on-chalk' : 'border-seam text-chalk-3'}`}
          >
            {MEAL_LABEL[m]}
          </button>
        ))}
      </div>
      <div className="relative">
        <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-chalk-4" />
        <input
          ref={inputRef}
          type="search"
          className="field h-12 pl-9 text-h4"
          placeholder="搜尋食物，例如：雞胸、白飯、無糖豆漿"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="搜尋食物"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" icon="plus" onClick={() => setCreating(true)}>
          依營養標示新增
        </Button>
        <Button size="sm" icon="flame" onClick={() => setQuick(true)}>
          只填熱量
        </Button>
      </div>

      {error && !tfda && (
        <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">衛福部食物資料庫載入失敗（{error}），目前只能搜尋自建食物。連上網路後重新開啟即可。</p>
      )}

      {q.trim() ? (
        <div className="flex flex-col gap-3">
          {templateResults.length > 0 && <TemplateList templates={templateResults} onPick={setPickedMeal} />}
          <div className="card divide-y divide-seam overflow-hidden">
            {results.map((it) => (
              <FoodRow key={it.key} item={it} onClick={() => setPicked(it)} />
            ))}
            {results.length === 0 && (
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <p className="text-chalk-3">{tfda ? '找不到符合的食物。' : '資料庫載入中…'}</p>
                {tfda && (
                  <Button size="sm" icon="plus" onClick={() => setCreating(true)}>
                    依營養標示自建「{q.trim()}」
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {(templates ?? []).length > 0 && <TemplateList templates={templates ?? []} onPick={setPickedMeal} />}
          {recent.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="label px-1">最近吃過</h2>
              <div className="card divide-y divide-seam overflow-hidden">
                {recent.map(({ u, item }) => (
                  <FoodRow key={item.key} item={item} hint={u.lastUnit === 'g' ? `上次 ${fmt(u.lastQty, 0)} g` : `上次 ${fmt(u.lastQty, 2)} 份`} onClick={() => setPicked(item)} />
                ))}
              </div>
            </section>
          )}
          {customItems.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="label flex items-center justify-between px-1">
                我的食物
                <Link to="/eat/foods" className="text-sm font-normal tracking-normal text-chalk-3">
                  管理
                </Link>
              </h2>
              <div className="card divide-y divide-seam overflow-hidden">
                {customItems.slice(0, 20).map((it) => (
                  <FoodRow key={it.key} item={it} onClick={() => setPicked(it)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {tfda && <p className="px-1 text-cap text-chalk-4">原型食物資料：衛生福利部食品藥物管理署「食品營養成分資料庫」（{tfda.version}），政府資料開放授權條款第 1 版。</p>}

      {picked && (
        <AmountSheet
          item={picked}
          meal={meal}
          lastQty={usageMap.get(picked.key)}
          onClose={() => setPicked(null)}
          onAdd={async (qty, unit, m) => {
            await addFoodLog({ date, meal: m, item: picked, qty, unit });
            setPicked(null);
            toast(`已加入${MEAL_LABEL[m]}：${picked.name}`);
            setQ('');
            inputRef.current?.focus();
          }}
        />
      )}
      {pickedMeal && (
        <MealTemplateSheet
          t={pickedMeal}
          onClose={() => setPickedMeal(null)}
          onAdd={async (mult) => {
            await logMealTemplate(pickedMeal, date, meal, mult);
            setPickedMeal(null);
            navigate(`/eat${date !== today ? `?date=${date}` : ''}`);
          }}
        />
      )}
      {creating && (
        <CustomFoodForm
          initialName={q.trim()}
          onClose={() => setCreating(false)}
          onSaved={(f) => {
            setCreating(false);
            setPicked(customToItem(f));
          }}
        />
      )}
      {quick && <QuickAddSheet meal={meal} date={date} onClose={() => setQuick(false)} />}
    </div>
  );
}

function FoodRow({ item, hint, onClick }: { item: FoodItem; hint?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-iron-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate">
          {item.name}
          {item.source === 'custom' && <span className="ml-1.5 text-cap text-chalk-4">自建</span>}
        </span>
        <span className="block truncate text-sm text-chalk-3">{hint ?? item.sub}</span>
      </span>
      <span className="num shrink-0 text-right text-sm">
        <span className="block font-semibold">{fmt(item.per.kcal, 0)} kcal</span>
        <span className="block text-cap text-chalk-3">蛋白質 {fmt(item.per.protein, 1)} g</span>
      </span>
    </button>
  );
}

function TemplateList({ templates, onPick }: { templates: MealTemplate[]; onPick: (t: MealTemplate) => void }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="label px-1">餐點組合</h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {templates.map((t) => {
          const kcal = t.items.reduce((a, it) => a + (it.per.basis === 'per100g' ? (it.per.kcal * it.qty) / 100 : it.per.kcal * it.qty), 0);
          return (
            <button key={t.id} type="button" onClick={() => onPick(t)} className="press card flex min-w-36 shrink-0 flex-col items-start gap-0.5 px-4 py-3 text-left hover:bg-iron-2">
              <span className="max-w-40 truncate font-medium">{t.name}</span>
              <span className="num text-sm text-chalk-3">
                {t.items.length} 樣 · {fmt(kcal, 0)} kcal
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AmountSheet({
  item,
  meal: initialMeal,
  lastQty,
  onClose,
  onAdd,
}: {
  item: FoodItem;
  meal: Meal;
  lastQty?: { lastQty: number; lastUnit: 'g' | 'serving' };
  onClose: () => void;
  onAdd: (qty: number, unit: 'g' | 'serving', meal: Meal) => Promise<void>;
}) {
  const servingOk = item.per.basis === 'perServing' || !!item.servingG;
  const gramOk = item.per.basis === 'per100g' || !!item.servingG;
  const defaultUnit: 'g' | 'serving' = lastQty?.lastUnit && (lastQty.lastUnit === 'g' ? gramOk : servingOk) ? lastQty.lastUnit : item.per.basis === 'perServing' ? 'serving' : 'g';
  const [unit, setUnit] = useState<'g' | 'serving'>(defaultUnit);
  const [qty, setQty] = useState<number | null>(lastQty && lastQty.lastUnit === defaultUnit ? lastQty.lastQty : defaultUnit === 'g' ? 100 : 1);
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [busy, setBusy] = useState(false);
  const n = qty ? computeEntry(item.per, qty, unit, item.servingG) : null;
  const chips = unit === 'g' ? [50, 100, 150, 200, 300] : [0.5, 1, 1.5, 2, 3];

  return (
    <Sheet
      open
      onClose={onClose}
      title={item.name}
      footer={
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!n || busy}
          onClick={async () => {
            if (!qty) return;
            setBusy(true);
            try {
              await onAdd(qty, unit, meal);
            } finally {
              setBusy(false);
            }
          }}
        >
          加入{MEAL_LABEL[meal]}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-chalk-3">{item.sub}</p>
        {servingOk && gramOk && (
          <Segmented
            ariaLabel="單位"
            value={unit}
            options={[
              { value: 'g', label: '公克' },
              { value: 'serving', label: item.servingLabel ? `份（${item.servingLabel}）` : '份' },
            ]}
            onChange={(u) => {
              setUnit(u);
              setQty(u === 'g' ? (item.servingG ?? 100) : 1);
            }}
          />
        )}
        <Field label={unit === 'g' ? '份量（公克）' : '份數'}>
          <NumberInput ariaLabel="份量" value={qty} step={unit === 'g' ? 10 : 0.5} decimals={unit === 'g' ? 0 : 2} min={0} max={5000} stepper size="lg" onChange={setQty} />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button key={c} type="button" onClick={() => setQty(c)} className={`press num h-9 rounded-full border px-3 text-sm ${qty === c ? 'border-chalk bg-chalk text-on-chalk' : 'border-seam text-chalk-2'}`}>
              {unit === 'g' ? `${c} g` : `${c} 份`}
            </button>
          ))}
        </div>
        <div className="num grid grid-cols-4 gap-2 rounded-md bg-well p-3 text-center">
          {[
            ['熱量', n?.kcal, 'kcal'],
            ['蛋白質', n?.protein, 'g'],
            ['碳水', n?.carbs, 'g'],
            ['脂肪', n?.fat, 'g'],
          ].map(([l, v, u]) => (
            <div key={l as string}>
              <p className="text-cap text-chalk-3">{l}</p>
              <p className="font-semibold">
                {v == null ? '–' : fmt(v as number, (v as number) < 10 && l !== '熱量' ? 1 : 0)}
                <span className="ml-0.5 text-cap font-normal text-chalk-3">{u}</span>
              </p>
            </div>
          ))}
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4" role="radiogroup" aria-label="加入哪一餐">
          {MEALS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={meal === m}
              onClick={() => setMeal(m)}
              className={`press h-8 shrink-0 rounded-full border px-3 text-sm ${meal === m ? 'border-chalk bg-chalk text-on-chalk' : 'border-seam text-chalk-3'}`}
            >
              {MEAL_LABEL[m]}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

function MealTemplateSheet({ t, onClose, onAdd }: { t: MealTemplate; onClose: () => void; onAdd: (mult: number) => Promise<void> }) {
  const [mult, setMult] = useState<number | null>(1);
  return (
    <Sheet
      open
      onClose={onClose}
      title={t.name}
      footer={
        <Button variant="primary" size="lg" block disabled={!mult} onClick={() => mult && void onAdd(mult)}>
          加入 {t.items.length} 樣
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-1">
          {t.items.map((it, i) => (
            <li key={i} className="num flex justify-between gap-3 text-sm">
              <span className="truncate text-chalk-2">{it.name}</span>
              <span className="shrink-0 text-chalk-3">{it.unit === 'g' ? `${fmt(it.qty * (mult ?? 1), 0)} g` : `${fmt(it.qty * (mult ?? 1), 2)} 份`}</span>
            </li>
          ))}
        </ul>
        <Field label="份量倍數" hint="例如只吃一半填 0.5">
          <NumberInput ariaLabel="份量倍數" value={mult} step={0.5} decimals={2} min={0.1} max={10} stepper onChange={setMult} />
        </Field>
      </div>
    </Sheet>
  );
}
