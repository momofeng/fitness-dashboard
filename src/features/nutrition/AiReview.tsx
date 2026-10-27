// AI 辨識結果的確認清單：每樣食物 = AI 認出的名稱 → 對應到的資料庫食物（可換）→ 重量（可改）→ 營養預覽。
// 營養數字只由資料庫的每 100 g（或每份）數值依重量換算；AI 只提供名稱與估計重量。

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FoodGuess } from '../../ai/provider';
import { matchGuess } from '../../core/foodMatch';
import { sumNutrients } from '../../core/nutrition';
import { searchItems } from '../../core/search';
import { fmt } from '../../core/units';
import { db } from '../../db/db';
import { useAiMatches, rememberMatches } from '../../db/repo/aiMatches';
import { addFoodLogs, computeEntry, customToItem, type FoodItem } from '../../db/repo/foods';
import { MEAL_LABEL, MEALS, type Meal } from '../../db/schemas';
import { Button } from '../../ui/Button';
import { NumberInput } from '../../ui/Fields';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { toastUndo } from '../../ui/toast';
import { useTfda } from './foodSource';

interface Row {
  id: number;
  guess: FoodGuess;
  item: FoodItem | null;
  /** 名稱／俗名完全相同且沒有其他同樣好的選項，或你校正過 */
  confident: boolean;
  candidates: FoodItem[];
  include: boolean;
  qty: number | null;
  unit: 'g' | 'serving';
  searching: boolean;
  q: string;
}

/** 只有「每份」數值又不知道一份幾克的食物，不能用克數：改成 1 份 */
function defaultAmount(item: FoodItem, grams: number): { qty: number; unit: 'g' | 'serving' } {
  if (item.per.basis === 'perServing' && !item.servingG) return { qty: 1, unit: 'serving' };
  return { qty: grams, unit: 'g' };
}

/** 單項重量／份數的上限（與加入食物頁的份量視窗相同）；超過就標紅擋下，不自動改成上限 */
const MAX_QTY = 5000;

let nextId = 1;

export function AiReview({
  guesses,
  photoUrl,
  date,
  meal: initialMeal,
  title,
  onClose,
  onAdded,
  onRetry,
}: {
  guesses: FoodGuess[];
  photoUrl?: string | null;
  date: string;
  meal: Meal;
  title: string;
  onClose: () => void;
  onAdded: () => void;
  onRetry?: () => void;
}) {
  const { db: tfda, error: tfdaError } = useTfda();
  const custom = useLiveQuery(() => db.foodsCustom.toArray(), []);
  const usage = useLiveQuery(() => db.foodUsage.orderBy('count').reverse().limit(200).toArray(), []);
  const learned = useAiMatches();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customItems = useMemo(() => (custom ?? []).map(customToItem), [custom]);
  const pool = useMemo(() => [...customItems, ...(tfda?.items ?? [])], [customItems, tfda]);
  const usageMap = useMemo(() => new Map((usage ?? []).map((u) => [u.foodKey, u.count])), [usage]);
  const boost = useCallback((it: FoodItem) => Math.min(40, (usageMap.get(it.key) ?? 0) * 8) + (it.source === 'custom' ? 10 : 0), [usageMap]);
  const byKey = useCallback((key: string) => (key.startsWith('custom:') ? customItems.find((c) => c.key === key) : tfda?.byKey.get(key)), [customItems, tfda]);

  // 資料都讀到了才做第一次對應（只做一次；之後的編輯都在 rows 狀態裡）
  const ready = custom !== undefined && usage !== undefined && learned !== undefined && (!!tfda || !!tfdaError);
  useEffect(() => {
    if (!ready || rows) return;
    setRows(
      guesses.map((guess) => {
        const m = matchGuess(guess, pool, byKey, learned!, { boost });
        const top = m.candidates[0]?.item ?? null;
        // 只有「名稱／俗名完全相同」或你校正過的才預設勾選；靠片段或「包含」猜到的（炒高麗菜 → 高麗菜、
        // 蘋果 → 蘋果絲瓜）不預設勾選：寧可讓你自己確認，也不要悄悄記錯
        const trusted = !!m.candidates[0]?.exact;
        const amt = top ? defaultAmount(top, guess.grams) : { qty: guess.grams, unit: 'g' as const };
        return {
          id: nextId++,
          guess,
          item: top,
          confident: m.confident,
          candidates: m.candidates.map((c) => c.item),
          include: !!top && trusted,
          qty: amt.qty,
          unit: amt.unit,
          searching: !top,
          q: '',
        };
      }),
    );
  }, [ready, rows, guesses, pool, byKey, learned, boost]);

  const patch = (id: number, p: Partial<Row>) => setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, ...p } : r)) ?? null);
  const pick = (r: Row, item: FoodItem) => {
    const keepGrams = r.unit === 'g' && r.qty ? r.qty : r.guess.grams;
    const amt = defaultAmount(item, keepGrams);
    patch(r.id, { item, include: true, qty: amt.qty, unit: amt.unit, searching: false, q: '', confident: true });
  };
  const addBlank = () =>
    setRows((rs) => [
      ...(rs ?? []),
      { id: nextId++, guess: { name: '', altNames: [], grams: 100, confidence: 0, cooked: false }, item: null, confident: false, candidates: [], include: false, qty: 100, unit: 'g', searching: true, q: '' },
    ]);

  const calc = (r: Row) => (r.item && r.qty && r.qty <= MAX_QTY ? computeEntry(r.item.per, r.qty, r.unit, r.item.servingG) : null);
  const included = (rows ?? []).filter((r) => r.include && r.item);
  const bad = included.some((r) => !calc(r));
  const total = sumNutrients(included.map(calc).filter((n): n is NonNullable<typeof n> => !!n));
  const canAdd = included.length > 0 && !bad && !busy;

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const logs = await addFoodLogs(
        date,
        meal,
        included.map((r) => ({ item: r.item!, qty: r.qty!, unit: r.unit })),
        'ai',
      );
      try {
        await rememberMatches(included.map((r) => ({ name: r.guess.name, foodKey: r.item!.key })));
      } catch {
        /* 記不住校正不影響已經寫入的紀錄 */
      }
      toastUndo(`已加入${MEAL_LABEL[meal]} ${logs.length} 項`, async () => {
        await db.foodLogs.bulkDelete(logs.map((l) => l.id));
      });
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : '加入失敗');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      footer={
        <div className="flex flex-col gap-2">
          <div className="num grid grid-cols-4 gap-2 rounded-md bg-well p-2 text-center" aria-label="合計">
            {[
              ['熱量', total.kcal, 'kcal'],
              ['蛋白質', total.protein, 'g'],
              ['碳水', total.carbs, 'g'],
              ['脂肪', total.fat, 'g'],
            ].map(([l, v, u]) => (
              <div key={l as string}>
                <p className="text-cap text-chalk-3">{l}</p>
                <p className="font-semibold">
                  {fmt(v as number, l === '熱量' || (v as number) >= 10 ? 0 : 1)}
                  <span className="ml-0.5 text-cap font-normal text-chalk-3">{u}</span>
                </p>
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          {bad && <p className="text-sm text-danger">有項目的重量是空白、超過 5,000 或無法換算，請修正或取消勾選。</p>}
          <Button variant="primary" size="lg" block disabled={!canAdd} onClick={() => void add()}>
            {included.length ? `加入 ${included.length} 項到${MEAL_LABEL[meal]}` : '請勾選要加入的食物'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          {photoUrl && <img src={photoUrl} alt="辨識的照片" className="h-16 w-16 shrink-0 rounded-md border border-seam object-cover" />}
          <p className="text-sm text-chalk-3">
            重量是 AI 估計的，誤差可能很大，請照實際份量調整。熱量與營養來自內建的衛福部食物資料庫，不是 AI 算的。
          </p>
        </div>

        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4" role="radiogroup" aria-label="加入哪一餐">
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

        {!rows ? (
          <p className="py-6 text-center text-chalk-3">{tfdaError && !tfda ? '食物資料庫載入失敗' : '對應食物資料庫中…'}</p>
        ) : (
          <>
            {tfdaError && !tfda && (
              <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">衛福部食物資料庫載入失敗（{tfdaError}），目前只能對應到自建食物。</p>
            )}
            {rows.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="text-chalk-3">沒有辨識出食物。</p>
                {onRetry && (
                  <Button size="sm" onClick={onRetry}>
                    重試
                  </Button>
                )}
              </div>
            )}
            <ul className="divide-y divide-seam">
              {rows.map((r) => {
                const n = calc(r);
                const needsCheck = !!r.item && (!r.confident || r.guess.confidence < 0.5);
                const results = r.searching ? (r.q.trim() ? searchItems(pool, r.q, 8, boost) : r.candidates) : [];
                return (
                  <li key={r.id} className="flex flex-col gap-2 py-3" aria-label={r.guess.name || '手動新增'}>
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={r.include}
                        aria-label={`加入 ${r.item?.name ?? r.guess.name}`}
                        disabled={!r.item}
                        onClick={() => patch(r.id, { include: !r.include })}
                        className={`press mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border disabled:opacity-40 ${r.include ? 'border-go bg-go text-on-chalk' : 'border-seam'}`}
                      >
                        {r.include && <Icon name="check" size={16} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{r.item ? r.item.name : '找不到對應的食物'}</p>
                        <p className="truncate text-sm text-chalk-3">
                          {r.guess.name ? `AI 認為：${r.guess.name}` : '手動新增'}
                          {r.item ? ` · ${r.item.sub}` : ''}
                        </p>
                        {needsCheck && <p className="text-cap text-warn">請確認是不是這個食物</p>}
                        {r.guess.cooked && r.item?.state?.startsWith('生') && (
                          <p className="text-cap text-warn">資料庫這筆是生食的數值，煮熟後同樣重量的熱量通常不同，可能不準；有「熟」的樣品請改選。</p>
                        )}
                      </div>
                      <Button size="sm" onClick={() => patch(r.id, { searching: !r.searching, q: '' })}>
                        {r.item ? '換食物' : '搜尋'}
                      </Button>
                    </div>

                    {r.searching && (
                      <div className="flex flex-col gap-2 rounded-md bg-well p-2">
                        <div className="relative">
                          <Icon name="search" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-chalk-3" />
                          <input
                            className="field h-10 pl-9 text-base"
                            type="search"
                            placeholder="搜尋食物"
                            aria-label={`搜尋「${r.guess.name || '食物'}」的對應食物`}
                            value={r.q}
                            onChange={(e) => patch(r.id, { q: e.target.value })}
                          />
                        </div>
                        {results.length === 0 ? (
                          <p className="px-1 text-sm text-chalk-3">{r.q.trim() ? '找不到符合的食物。' : '沒有候選，請輸入關鍵字搜尋。'}</p>
                        ) : (
                          <ul className="flex flex-col divide-y divide-seam">
                            {results.map((it) => (
                              <li key={it.key}>
                                <button type="button" onClick={() => pick(r, it)} className="press flex min-h-11 w-full items-center gap-3 px-1 py-1.5 text-left hover:bg-iron-3">
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate">{it.name}</span>
                                    <span className="block truncate text-cap text-chalk-3">{it.sub}</span>
                                  </span>
                                  <span className="num shrink-0 text-sm text-chalk-2">{fmt(it.per.kcal, 0)} kcal</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {r.item && (
                      <div className="flex flex-col gap-2 pl-9">
                        <div className="flex items-center gap-2">
                          <NumberInput
                            className="flex-1"
                            ariaLabel={`${r.item.name}的${r.unit === 'g' ? '重量（公克）' : '份數'}`}
                            value={r.qty}
                            step={r.unit === 'g' ? 10 : 0.5}
                            decimals={r.unit === 'g' ? 0 : 2}
                            min={0}
                            max={MAX_QTY}
                            clamp={false}
                            suffix={r.unit === 'g' ? 'g' : '份'}
                            stepper
                            onChange={(v) => patch(r.id, { qty: v })}
                          />
                          {r.item.servingG ? (
                            <button
                              type="button"
                              onClick={() => patch(r.id, { unit: 'g', qty: r.item!.servingG })}
                              className="press num h-9 shrink-0 rounded-full border border-seam px-3 text-sm text-chalk-2"
                            >
                              1 份 ≈ {fmt(r.item.servingG, 0)} g
                            </button>
                          ) : null}
                        </div>
                        <p className="num text-sm text-chalk-3">
                          {n ? (
                            <>
                              <span className="font-semibold text-chalk">{fmt(n.kcal, 0)} kcal</span> · 蛋白質 {fmt(n.protein, 1)} · 碳水 {fmt(n.carbs, 1)} · 脂肪 {fmt(n.fat, 1)}
                            </>
                          ) : (
                            '輸入重量後顯示營養'
                          )}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon="plus" onClick={addBlank}>
                補一樣
              </Button>
              {onRetry && rows.length > 0 && (
                <Button size="sm" variant="ghost" onClick={onRetry}>
                  重新辨識
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
