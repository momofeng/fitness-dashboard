// 我的補給品與裝備：成本（每份、每克蛋白質）、CP 值比較、庫存估算與補貨提醒、每日打卡、裝備每次訓練成本。

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  GEAR_CATEGORIES,
  PRODUCT_CATEGORY_LABEL,
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUSES,
  SUPPLEMENT_CATEGORIES,
  type ProductCategory,
  type ProductKind,
  type ProductStatus,
} from '../../content/types';
import { costPerGramProtein, costPerServing, daysLeft, gearCostPerSession, needsRestock, rankByValue, servingsLeft } from '../../core/products';
import { shortDateLabel } from '../../core/dates';
import { fmt } from '../../core/units';
import { db } from '../../db/db';
import { isValidDay, LIMITS } from '../../db/limits';
import { deleteProduct, restock, restoreProduct, saveProduct, setCheckIn, useConsumed, useProducts, useSupplementLogsOn, validateProduct, type ProductInput } from '../../db/repo/products';
import type { Product } from '../../db/schemas';
import { Button, IconButton } from '../../ui/Button';
import { Field, NumberInput, Segmented, TextField } from '../../ui/Fields';
import { Icon } from '../../ui/Icon';
import { EmptyState, PageHeader, Section } from '../../ui/Layout';
import { Sheet } from '../../ui/Sheet';
import { toast, toastUndo } from '../../ui/toast';
import { useTargets } from '../shared/useToday';

const money = (v: number, d = 0) => `NT$${fmt(v, d)}`;

export default function ProductsPage() {
  const { today, settings } = useTargets();
  const [params, setParams] = useSearchParams();
  const products = useProducts();
  const consumed = useConsumed();
  const logs = useSupplementLogsOn(today);
  const [kind, setKind] = useState<ProductKind>(params.get('kind') === 'gear' ? 'gear' : 'supplement');
  const [form, setForm] = useState<Product | ProductInput | null>(null);

  // 從知識卡帶入：/products?new=protein&name=乳清蛋白
  useEffect(() => {
    const cat = params.get('new');
    if (!cat) return;
    const category = ((SUPPLEMENT_CATEGORIES as readonly string[]).includes(cat) ? cat : 'other') as ProductCategory;
    setKind('supplement');
    setForm(blank('supplement', category, params.get('name') ?? ''));
    setParams({}, { replace: true });
  }, [params, setParams]);

  if (!products || !consumed || !logs || !settings) return null;
  const list = products.filter((p) => p.kind === kind);
  const using = list.filter((p) => p.status !== 'finished');
  const finished = list.filter((p) => p.status === 'finished');
  const checked = new Map(logs.map((l) => [l.productId, l]));

  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader
        title="我的補給品與裝備"
        back="/more"
        actions={
          <Button size="sm" icon="plus" onClick={() => setForm(blank(kind, kind === 'gear' ? 'belt' : 'protein', ''))}>
            新增
          </Button>
        }
      />
      <Segmented
        ariaLabel="種類"
        value={kind}
        options={[
          { value: 'supplement', label: '補給品' },
          { value: 'gear', label: '裝備' },
        ]}
        onChange={setKind}
      />
      {kind === 'supplement' && (
        <p className="text-sm text-chalk-3">
          記下價格、份數與每份蛋白質，就能比較每克蛋白質多少錢；設定每天吃幾份，快吃完會提醒補貨。不確定該不該買？先看
          <Link to="/supplements" className="text-chalk-2 underline decoration-chalk-4 underline-offset-2">
            補給品知識卡
          </Link>
          。
        </p>
      )}

      {using.length === 0 ? (
        <EmptyState
          icon={kind === 'gear' ? 'dumbbell' : 'drop'}
          title={kind === 'gear' ? '還沒有裝備' : '還沒有補給品'}
          body={kind === 'gear' ? '例如舉重腰帶、訓練鞋、助握帶。會算出平均每次訓練的成本。' : '例如乳清蛋白、肌酸。也可以把「考慮中」的產品加進來比價。'}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {using.map((p) =>
            p.kind === 'gear' ? (
              <GearCard key={p.id} p={p} onEdit={() => setForm(p)} />
            ) : (
              <SupplementCard key={p.id} p={p} consumed={consumed.get(p.id) ?? 0} checked={checked.has(p.id)} today={today} onEdit={() => setForm(p)} />
            ),
          )}
        </div>
      )}

      {kind === 'supplement' && <ValueCompare products={list} />}

      {finished.length > 0 && (
        <Section title={`已用完（${finished.length}）`}>
          <div className="card divide-y divide-seam overflow-hidden">
            {finished.map((p) => (
              <button key={p.id} type="button" onClick={() => setForm(p)} className="press flex min-h-12 w-full items-center gap-3 px-4 text-left hover:bg-iron-2">
                <span className="min-w-0 flex-1 truncate text-sm text-chalk-2">{p.name}</span>
                <Icon name="chevronRight" size={16} className="text-chalk-3" />
              </button>
            ))}
          </div>
        </Section>
      )}
      <p className="px-1 text-cap text-chalk-3">價格與營養標示請照包裝填寫；App 不提供任何品牌推薦。</p>

      {form && <ProductForm initial={form} onClose={() => setForm(null)} />}
    </div>
  );
}

function blank(kind: ProductKind, category: ProductCategory, name: string): ProductInput {
  return {
    kind,
    name,
    brand: '',
    category,
    status: 'using',
    price: null,
    servingsPerContainer: null,
    servingLabel: '',
    proteinPerServingG: null,
    dailyServings: kind === 'supplement' ? 1 : null,
    containersBought: 1,
    adjustServings: 0,
    remindDays: kind === 'supplement' ? 7 : 0,
    purchasedAt: null,
    note: '',
  };
}

function SupplementCard({ p, consumed, checked, today, onEdit }: { p: Product; consumed: number; checked: boolean; today: string; onEdit: () => void }) {
  const left = servingsLeft(p, consumed);
  const days = daysLeft(left, p.dailyServings);
  const perServing = costPerServing(p.price, p.servingsPerContainer);
  const perGram = costPerGramProtein(p.price, p.servingsPerContainer, p.proteinPerServingG);
  const restockDue = needsRestock(p, consumed);
  return (
    <section className="card flex flex-col gap-3 p-4" aria-label={p.name}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{p.name}</p>
          <p className="truncate text-sm text-chalk-3">
            {PRODUCT_CATEGORY_LABEL[p.category]}
            {p.brand && ` · ${p.brand}`}
            {p.status === 'candidate' && ' · 考慮中'}
          </p>
        </div>
        <IconButton icon="edit" label={`編輯 ${p.name}`} onClick={onEdit} />
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="label">每份</dt>
          <dd className="num font-semibold">{perServing != null ? money(perServing, 1) : '–'}</dd>
        </div>
        <div>
          <dt className="label">每克蛋白質</dt>
          <dd className="num font-semibold">{perGram != null ? money(perGram, 2) : '–'}</dd>
        </div>
        {p.status === 'using' && (
          <div className="col-span-2">
            <dt className="label">庫存</dt>
            <dd className="num">
              {p.servingsPerContainer ? (
                <>
                  剩 {fmt(Math.max(0, left), 1)} 份{days != null && `，約 ${days} 天`}
                  {left < 0 && <span className="text-warn">（打卡比買的多，請到編輯校正庫存）</span>}
                </>
              ) : (
                <span className="text-chalk-3">填寫每罐份數就能估庫存</span>
              )}
            </dd>
          </div>
        )}
      </dl>
      {restockDue && (
        <p className="flex items-center gap-2 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn" role="status">
          <Icon name="info" size={16} />
          快吃完了，該補貨了。
        </p>
      )}
      {p.status === 'using' && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={checked ? 'go' : 'secondary'}
            icon="check"
            aria-pressed={checked}
            onClick={() =>
              void setCheckIn(p.id, today, checked ? null : p.dailyServings && p.dailyServings >= LIMITS.logServings[0] ? p.dailyServings : 1).catch((e: unknown) =>
                toast(e instanceof Error ? e.message : String(e), { tone: 'error' }),
              )
            }
          >
            {checked ? '今天已吃' : '今天打卡'}
          </Button>
          <Button icon="plus" disabled={!p.servingsPerContainer} onClick={() => void restock(p.id).then(() => toast(`已補貨一罐：${p.name}`))}>
            補貨一罐
          </Button>
        </div>
      )}
    </section>
  );
}

function GearCard({ p, onEdit }: { p: Product; onEdit: () => void }) {
  const sessions = useLiveQuery(
    () =>
      db.workouts
        .where('status')
        .equals('done')
        .filter((w) => !p.purchasedAt || w.date >= p.purchasedAt)
        .count(),
    [p.purchasedAt],
  );
  const per = sessions != null ? gearCostPerSession(p.price, sessions) : null;
  return (
    <section className="card flex flex-col gap-2 p-4" aria-label={p.name}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{p.name}</p>
          <p className="truncate text-sm text-chalk-3">
            {PRODUCT_CATEGORY_LABEL[p.category]}
            {p.brand && ` · ${p.brand}`}
            {p.purchasedAt && ` · ${shortDateLabel(p.purchasedAt)} 購入`}
          </p>
        </div>
        <IconButton icon="edit" label={`編輯 ${p.name}`} onClick={onEdit} />
      </div>
      <p className="num text-sm">
        {p.price != null ? money(p.price) : '未填價格'}
        {per != null && <span className="text-chalk-3"> · 平均每次訓練 {money(per, 1)}（{sessions} 次）</span>}
        {per == null && p.price != null && <span className="text-chalk-3"> · 完成訓練後會算出每次成本</span>}
      </p>
      {p.note && <p className="text-sm text-chalk-3">{p.note}</p>}
    </section>
  );
}

/** 同類別 ≥ 2 個產品時，依每克蛋白質（蛋白粉）或每份成本排序 */
function ValueCompare({ products }: { products: Product[] }) {
  const groups = SUPPLEMENT_CATEGORIES.map((cat) => ({ cat, items: products.filter((p) => p.category === cat && p.status !== 'finished') })).filter((g) => g.items.length >= 2);
  if (groups.length === 0) return null;
  return (
    <Section title="CP 值比較">
      {groups.map(({ cat, items }) => {
        const by = cat === 'protein' ? 'protein' : 'serving';
        const ranked = rankByValue(items, by);
        const best = ranked[0]?.cost;
        return (
          <section key={cat} className="card flex flex-col gap-2 p-4" aria-label={`${PRODUCT_CATEGORY_LABEL[cat]} CP 值比較`}>
            <p className="text-sm font-medium text-chalk-2">
              {PRODUCT_CATEGORY_LABEL[cat]} · {by === 'protein' ? '每克蛋白質' : '每份'}成本，便宜到貴
            </p>
            <ol className="flex flex-col gap-1">
              {ranked.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 text-sm">
                  <span className="num w-5 shrink-0 text-chalk-3">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {p.name}
                    {p.status === 'candidate' && <span className="text-chalk-3">（考慮中）</span>}
                  </span>
                  <span className="num shrink-0 font-semibold">{p.cost != null ? money(p.cost, 2) : '資料不足'}</span>
                  {p.cost != null && best != null && best > 0 && i > 0 && <span className="num w-14 shrink-0 text-right text-cap text-chalk-3">+{Math.round((p.cost / best - 1) * 100)}%</span>}
                  {(i === 0 || p.cost == null || best == null || best <= 0) && <span className="w-14 shrink-0" />}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </Section>
  );
}

function ProductForm({ initial, onClose }: { initial: Product | ProductInput; onClose: () => void }) {
  const [p, setP] = useState<ProductInput>({ ...initial });
  const { today } = useTargets();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [touched, setTouched] = useState(false);
  const set = (patch: Partial<ProductInput>) => {
    setTouched(true);
    setP((cur) => ({ ...cur, ...patch }));
  };
  const isNew = !('id' in initial) || !initial.id;
  const supp = p.kind === 'supplement';
  const error = validateProduct(p);
  const cats = supp ? SUPPLEMENT_CATEGORIES : GEAR_CATEGORIES;
  const num = (key: keyof ProductInput, label: string, lim: readonly [number, number], opts: { decimals?: number; suffix?: string; nullable?: boolean } = {}) => (
    <Field label={label}>
      <NumberInput
        ariaLabel={label}
        value={p[key] as number | null}
        decimals={opts.decimals ?? 2}
        min={lim[0]}
        max={lim[1]}
        clamp={false}
        suffix={opts.suffix}
        onChange={(v) => set({ [key]: v == null ? (opts.nullable === false ? 0 : null) : v } as Partial<ProductInput>)}
      />
    </Field>
  );

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? (supp ? '新增補給品' : '新增裝備') : `編輯 ${initial.name}`}
      footer={
        <div className="flex flex-col gap-2">
          {error && touched && <p className="text-sm text-danger">{error}</p>}
          <Button
            variant="primary"
            block
            disabled={!!error}
            onClick={() =>
              void saveProduct(p)
                .then(() => {
                  toast(isNew ? '已新增' : '已更新');
                  onClose();
                })
                .catch((e: unknown) => toast(e instanceof Error ? e.message : String(e), { tone: 'error' }))
            }
          >
            儲存
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="名稱" value={p.name} maxLength={60} placeholder={supp ? '例如：乳清蛋白 2 磅巧克力' : '例如：10 mm 舉重腰帶'} onChange={(e) => set({ name: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="類別">
            <select className="field" aria-label="類別" value={p.category} onChange={(e) => set({ category: e.target.value as ProductCategory })}>
              {cats.map((c) => (
                <option key={c} value={c}>
                  {PRODUCT_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>
          <TextField label="品牌（選填）" value={p.brand} maxLength={60} onChange={(e) => set({ brand: e.target.value })} />
        </div>
        <Field label="狀態">
          <Segmented<ProductStatus> ariaLabel="狀態" value={p.status} options={PRODUCT_STATUSES.map((s) => ({ value: s, label: !supp && s === 'finished' ? '不用了' : PRODUCT_STATUS_LABEL[s] }))} onChange={(v) => set({ status: v })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          {num('price', supp ? '每罐價格' : '價格', LIMITS.priceTwd, { decimals: 0, suffix: '元' })}
          {supp ? num('servingsPerContainer', '每罐份數', LIMITS.servingsPerContainer, { decimals: 1, suffix: '份' }) : (
            <Field label="購買日期">
              <input type="date" className="field" aria-label="購買日期" max={today} aria-invalid={(p.purchasedAt != null && !isValidDay(p.purchasedAt)) || undefined} value={p.purchasedAt ?? ''} onChange={(e) => set({ purchasedAt: e.target.value || null })} />
            </Field>
          )}
        </div>
        {supp && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="一份是" value={p.servingLabel} maxLength={30} placeholder={p.category === 'protein' ? '例如：1 匙 30 g' : p.category === 'creatine' ? '例如：1 匙 5 g' : '例如：1 顆'} onChange={(e) => set({ servingLabel: e.target.value })} />
              {p.category === 'protein' ? num('proteinPerServingG', '每份蛋白質', LIMITS.proteinPerServingG, { decimals: 1, suffix: 'g' }) : <span />}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {num('dailyServings', '每天吃幾份', LIMITS.dailyServings, { decimals: 2, suffix: '份' })}
              {num('remindDays', '剩幾天提醒', LIMITS.remindDays, { decimals: 0, suffix: '天', nullable: false })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {num('containersBought', '已買罐數', LIMITS.containers, { decimals: 0, suffix: '罐', nullable: false })}
              {num('adjustServings', '庫存校正', LIMITS.adjustServings, { decimals: 1, suffix: '份', nullable: false })}
            </div>
            <p className="text-cap text-chalk-3">庫存＝已買罐數 × 每罐份數＋校正 − 打卡份數。開始用 App 前已經吃掉的份數，請在校正填負數。</p>
          </>
        )}
        <Field label="備註（選填）">
          <textarea className="field min-h-16 py-2" maxLength={500} value={p.note} onChange={(e) => set({ note: e.target.value })} aria-label="備註" />
        </Field>
        {!isNew && 'id' in initial && initial.id && (
          <Button
            variant="danger"
            icon="trash"
            block
            onClick={async () => {
              if (!confirmDelete) return setConfirmDelete(true);
              const removed = await deleteProduct(initial.id!);
              onClose();
              if (removed) toastUndo(`已刪除「${removed.product.name}」`, () => restoreProduct(removed));
            }}
          >
            {confirmDelete ? '確定刪除（含打卡紀錄）' : '刪除'}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
