import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { kcalFromMacros } from '../../core/nutrition';
import { fmt } from '../../core/units';
import { db } from '../../db/db';
import { saveCustomFood } from '../../db/repo/foods';
import type { CustomFood, MealTemplate } from '../../db/schemas';
import { Button, IconButton } from '../../ui/Button';
import { Field, NumberInput, Segmented, TextField } from '../../ui/Fields';
import { EmptyState, PageHeader } from '../../ui/Layout';
import { Sheet } from '../../ui/Sheet';
import { toastUndo } from '../../ui/toast';

export default function MyFoods() {
  const [tab, setTab] = useState<'foods' | 'meals'>('foods');
  const foods = useLiveQuery(() => db.foodsCustom.orderBy('name').toArray(), []);
  const meals = useLiveQuery(() => db.mealTemplates.orderBy('name').toArray(), []);
  const [editing, setEditing] = useState<CustomFood | 'new' | null>(null);
  const [editingMeal, setEditingMeal] = useState<MealTemplate | null>(null);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader
        title="我的食物"
        back="/eat"
        actions={
          tab === 'foods' && (
            <Button size="sm" icon="plus" onClick={() => setEditing('new')}>
              新增
            </Button>
          )
        }
      />
      <Segmented
        ariaLabel="分類"
        value={tab}
        options={[
          { value: 'foods', label: `自建食物（${foods?.length ?? 0}）` },
          { value: 'meals', label: `餐點組合（${meals?.length ?? 0}）` },
        ]}
        onChange={setTab}
      />

      {tab === 'foods' &&
        (foods && foods.length > 0 ? (
          <div className="card divide-y divide-seam overflow-hidden">
            {foods.map((f) => (
              <button key={f.id} type="button" onClick={() => setEditing(f)} className="press flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-iron-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{f.name}</span>
                  <span className="block truncate text-sm text-chalk-3">
                    {[f.brand, f.per.basis === 'perServing' ? `每${f.servingLabel || '份'}${f.servingG ? `（${f.servingG} g）` : ''}` : '每 100 g'].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="num shrink-0 text-right text-sm">
                  <span className="block font-semibold">{fmt(f.per.kcal, 0)} kcal</span>
                  <span className="block text-cap text-chalk-3">蛋白質 {fmt(f.per.protein, 1)} g</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="bowl"
            title="還沒有自建食物"
            body="超商便當、乳清、常買的零食，照包裝上的營養標示輸入一次，之後就能直接搜尋。"
            action={
              <Button variant="primary" icon="plus" onClick={() => setEditing('new')}>
                依營養標示新增
              </Button>
            }
          />
        ))}

      {tab === 'meals' &&
        (meals && meals.length > 0 ? (
          <div className="card divide-y divide-seam overflow-hidden">
            {meals.map((m) => (
              <button key={m.id} type="button" onClick={() => setEditingMeal(m)} className="press flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-iron-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{m.name}</span>
                  <span className="block truncate text-sm text-chalk-3">{m.items.map((i) => i.name).join('、')}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState icon="copy" title="還沒有餐點組合" body="在飲食頁某一餐右邊的「⋯」選「存成組合」，例如固定的早餐或練後餐。" />
        ))}

      {editing && <CustomFoodForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {editingMeal && <MealTemplateEditor t={editingMeal} onClose={() => setEditingMeal(null)} />}
    </div>
  );
}

export function CustomFoodForm({ initial, initialName, onClose, onSaved }: { initial?: CustomFood; initialName?: string; onClose: () => void; onSaved?: (f: CustomFood) => void }) {
  const [name, setName] = useState(initial?.name ?? initialName ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [basis, setBasis] = useState<'per100g' | 'perServing'>(initial?.per.basis ?? 'perServing');
  const [servingG, setServingG] = useState<number | null>(initial?.servingG ?? null);
  const [servingLabel, setServingLabel] = useState(initial?.servingLabel ?? '');
  const [kcal, setKcal] = useState<number | null>(initial?.per.kcal ?? null);
  const [p, setP] = useState<number | null>(initial?.per.protein ?? null);
  const [f, setF] = useState<number | null>(initial?.per.fat ?? null);
  const [c, setC] = useState<number | null>(initial?.per.carbs ?? null);
  const [fiber, setFiber] = useState<number | null>(initial?.per.fiber ?? null);
  const [sodium, setSodium] = useState<number | null>(initial?.per.sodium ?? null);

  const valid = name.trim() && kcal != null && p != null && f != null && c != null;
  const est = kcalFromMacros(p ?? 0, c ?? 0, f ?? 0);
  const mismatch = valid && kcal! > 0 && Math.abs(est - kcal!) > Math.max(20, kcal! * 0.2);

  async function save() {
    if (!valid) return;
    const row = await saveCustomFood({
      id: initial?.id,
      name: name.trim(),
      brand: brand.trim(),
      barcode: initial?.barcode ?? '',
      servingG,
      servingLabel: servingLabel.trim(),
      per: { basis, kcal: kcal!, protein: p!, fat: f!, carbs: c!, fiber: fiber ?? undefined, sodium: sodium ?? undefined },
    });
    onSaved?.(row);
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={initial ? '編輯食物' : '依營養標示新增'}
      footer={
        <div className="flex gap-2">
          {initial && (
            <Button
              variant="danger"
              icon="trash"
              onClick={async () => {
                await db.foodsCustom.delete(initial.id);
                onClose();
                toastUndo(`已刪除「${initial.name}」`, () => db.foodsCustom.put(initial));
              }}
            >
              刪除
            </Button>
          )}
          <Button variant="primary" size="lg" block className="flex-1" disabled={!valid} onClick={() => void save()}>
            儲存
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="名稱" value={name} maxLength={80} placeholder="例如：舒肥雞胸（原味）" onChange={(e) => setName(e.target.value)} />
        <TextField label="品牌／店家（選填）" value={brand} maxLength={60} onChange={(e) => setBrand(e.target.value)} />
        <Field label="營養標示的基準" hint="台灣包裝的營養標示通常同時有「每一份量」與「每 100 公克」，擇一照抄即可">
          <Segmented
            ariaLabel="營養標示的基準"
            value={basis}
            options={[
              { value: 'perServing', label: '每一份量' },
              { value: 'per100g', label: '每 100 公克' },
            ]}
            onChange={setBasis}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="一份是幾克（選填）" hint="填了就能用克數記錄">
            <NumberInput ariaLabel="一份幾克" value={servingG} decimals={1} min={0} max={5000} suffix="g" onChange={setServingG} />
          </Field>
          <TextField label="份量名稱（選填）" value={servingLabel} maxLength={30} placeholder="例如：1 包、1 匙" onChange={(e) => setServingLabel(e.target.value)} />
        </div>
        <p className="label px-0.5">{basis === 'perServing' ? '每一份量含' : '每 100 公克含'}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="熱量">
            <NumberInput ariaLabel="熱量" value={kcal} decimals={1} min={0} max={10000} suffix="kcal" onChange={setKcal} />
          </Field>
          <Field label="蛋白質">
            <NumberInput ariaLabel="蛋白質" value={p} decimals={1} min={0} max={1000} suffix="g" onChange={setP} />
          </Field>
          <Field label="脂肪">
            <NumberInput ariaLabel="脂肪" value={f} decimals={1} min={0} max={1000} suffix="g" onChange={setF} />
          </Field>
          <Field label="碳水化合物">
            <NumberInput ariaLabel="碳水化合物" value={c} decimals={1} min={0} max={1000} suffix="g" onChange={setC} />
          </Field>
          <Field label="膳食纖維（選填）">
            <NumberInput ariaLabel="膳食纖維" value={fiber} decimals={1} min={0} max={1000} suffix="g" onChange={setFiber} />
          </Field>
          <Field label="鈉（選填）">
            <NumberInput ariaLabel="鈉" value={sodium} decimals={0} min={0} max={100000} suffix="mg" onChange={setSodium} />
          </Field>
        </div>
        {mismatch && (
          <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
            依蛋白質、碳水、脂肪推算約 {Math.round(est)} kcal，和填的熱量差很多，請再核對一次（有糖醇或酒精時本來就會有差異）。
          </p>
        )}
      </div>
    </Sheet>
  );
}

function MealTemplateEditor({ t, onClose }: { t: MealTemplate; onClose: () => void }) {
  const [name, setName] = useState(t.name);
  const [items, setItems] = useState(t.items);
  return (
    <Sheet
      open
      onClose={onClose}
      title="編輯餐點組合"
      footer={
        <div className="flex gap-2">
          <Button
            variant="danger"
            icon="trash"
            onClick={async () => {
              await db.mealTemplates.delete(t.id);
              onClose();
              toastUndo(`已刪除「${t.name}」`, () => db.mealTemplates.put(t));
            }}
          >
            刪除
          </Button>
          <Button
            variant="primary"
            size="lg"
            block
            className="flex-1"
            disabled={!name.trim() || items.length === 0}
            onClick={async () => {
              await db.mealTemplates.put({ ...t, name: name.trim(), items, updatedAt: Date.now() });
              onClose();
            }}
          >
            儲存
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="名稱" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <div className="flex flex-col gap-2">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm">{it.name}</span>
              <NumberInput
                ariaLabel={`${it.name} 份量`}
                value={it.qty}
                decimals={it.unit === 'g' ? 0 : 2}
                min={0.01}
                max={5000}
                suffix={it.unit === 'g' ? 'g' : '份'}
                className="w-28"
                onChange={(v) => v && setItems(items.map((x, j) => (j === i ? { ...x, qty: v } : x)))}
              />
              <IconButton icon="x" label={`移除 ${it.name}`} size={36} onClick={() => setItems(items.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
