import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { PROGRAM_TEMPLATES } from '../../content/programTemplates';
import { todayKey } from '../../core/dates';
import { ACTIVITY_LEVELS } from '../../core/nutrition';
import { fmt, fromDisplayWeight, toDisplayWeight, type WeightUnit } from '../../core/units';
import { upsertBodyMetric } from '../../db/repo/body';
import { activateTemplate } from '../../db/repo/programs';
import { updateSettings, useSettings } from '../../db/repo/settings';
import type { Settings } from '../../db/schemas';
import { inRange, LIMITS } from '../../db/limits';
import { requestPersist } from '../../lib/platform';
import { Button } from '../../ui/Button';
import { Field, NumberInput, Segmented, TextField } from '../../ui/Fields';
import { Icon } from '../../ui/Icon';
import { RestoreBackup } from '../settings/RestoreBackup';
import { computeTargets } from '../shared/useToday';

const STEPS = ['開始', '基本資料', '活動量', '目標', '課表'] as const;

export default function Onboarding() {
  const settings = useSettings();
  if (!settings) return <div className="min-h-dvh bg-floor" />;
  return <Wizard initial={settings} />;
}

function Wizard({ initial }: { initial: Settings }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [profile, setProfile] = useState(initial.profile);
  const [unit, setUnit] = useState<WeightUnit>(initial.units.weight);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [bodyFat, setBodyFat] = useState<number | null>(null);
  const [nutrition, setNutrition] = useState(initial.nutrition);
  const [templateId, setTemplateId] = useState<string | null>(
    initial.profile.experience === 'novice' ? 'novice-fullbody-barbell' : 'upper-lower-4',
  );
  const [saving, setSaving] = useState(false);

  const today = todayKey(initial.dayCutoffHour);
  const draft: Settings = { ...initial, profile, nutrition, units: { weight: unit } };
  const targets = useMemo(() => (weightKg ? computeTargets(draft, weightKg, today) : null), [weightKg, profile, nutrition, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const weightOk = weightKg != null && inRange('weightKg', weightKg);
  const fatOk = bodyFat == null || inRange('bodyFatPct', bodyFat);
  const basicsValid = weightOk && fatOk && profile.heightCm >= 120 && profile.heightCm <= 230 && profile.birthYear >= 1930 && profile.birthYear <= 2012;

  async function finish() {
    setSaving(true);
    try {
      await upsertBodyMetric(today, { weightKg, bodyFatPct: bodyFat });
      if (templateId) await activateTemplate(templateId);
      await updateSettings({
        onboarded: true,
        disclaimerAcceptedAt: Date.now(),
        profile,
        nutrition,
        units: { weight: unit },
      });
      await requestPersist();
      navigate('/', { replace: true });
    } finally {
      setSaving(false);
    }
  }

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))]">
      {/* 進度：五格粉筆刻度 */}
      <div className="flex items-center gap-1.5 py-2" aria-label={`第 ${step + 1} 步，共 ${STEPS.length} 步`}>
        {STEPS.map((s, i) => (
          <span key={s} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-chalk' : 'bg-iron-3'}`} />
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-6 py-6">
        {step === 0 && (
          <>
            <div className="flex flex-col gap-3">
              <p className="label">增肌日誌</p>
              <h1 className="text-h1 font-semibold">把每一組、每一餐都記下來</h1>
              <p className="text-h4 text-chalk-2">訓練、飲食、體重放在同一個地方，看得出來有沒有在進步。</p>
            </div>
            <ul className="flex flex-col gap-3">
              {[
                ['dumbbell', '新手課表與自動加重建議，照著練就好'],
                ['bowl', '內建衛福部食物資料庫，算熱量與蛋白質'],
                ['chart', '體重 7 日均線，判斷增肌速度是否合適'],
              ].map(([icon, text]) => (
                <li key={text} className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-iron-2 text-chalk-2">
                    <Icon name={icon as 'dumbbell'} />
                  </span>
                  <span className="text-base text-chalk-2">{text}</span>
                </li>
              ))}
            </ul>
            <div className="card flex flex-col gap-3 p-4">
              <p className="text-base font-medium">開始前請先了解</p>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-base text-chalk-2">
                <li>熱量、營養素與重量建議都是依公式算出的<strong className="text-chalk">估算值</strong>，不是醫療或營養諮詢。有傷病、慢性病或特殊飲食需求請先詢問醫師。</li>
                <li>資料<strong className="text-chalk">只存在這支手機</strong>，不會上傳。換手機或清除瀏覽器資料前，請先到「設定 → 資料與備份」匯出備份。</li>
              </ul>
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-5 w-5 accent-[var(--go)]" />
                <span className="text-base">我了解，開始設定</span>
              </label>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm text-chalk-3">換了新手機？可以直接用之前匯出的備份檔還原。</p>
              <RestoreBackup label="從備份檔還原" buttonProps={{ variant: 'ghost' }} onDone={() => {
                  // 還原後整頁重新載入，所有畫面都從新資料開始
                  location.hash = '#/';
                  location.reload();
                }}
              />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <StepTitle title="基本資料" sub="用來估算每日消耗熱量" />
            <TextField label="暱稱（選填）" value={profile.name} maxLength={40} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            <Field label="生理性別">
              <Segmented
                ariaLabel="生理性別"
                value={profile.sex}
                options={[
                  { value: 'male', label: '男' },
                  { value: 'female', label: '女' },
                ]}
                onChange={(v) => setProfile({ ...profile, sex: v })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="出生年（西元）">
                <NumberInput ariaLabel="出生年" value={profile.birthYear} decimals={0} min={1930} max={2012} onChange={(v) => v != null && setProfile({ ...profile, birthYear: Math.round(v) })} />
              </Field>
              <Field label="身高">
                <NumberInput ariaLabel="身高" value={profile.heightCm} suffix="cm" decimals={1} min={120} max={230} onChange={(v) => v != null && setProfile({ ...profile, heightCm: v })} />
              </Field>
            </div>
            <Field label="重量單位">
              <Segmented
                ariaLabel="重量單位"
                value={unit}
                options={[
                  { value: 'kg', label: '公斤 kg' },
                  { value: 'lb', label: '磅 lb' },
                ]}
                onChange={setUnit}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="目前體重">
                <NumberInput
                  ariaLabel="目前體重"
                  value={weightKg == null ? null : toDisplayWeight(weightKg, unit)}
                  suffix={unit}
                  decimals={1}
                  min={Number(toDisplayWeight(LIMITS.weightKg[0], unit).toFixed(1))}
                  max={Number(toDisplayWeight(LIMITS.weightKg[1], unit).toFixed(1))}
                  clamp={false}
                  placeholder={unit === 'kg' ? '例 68.5' : '例 150'}
                  onChange={(v) => setWeightKg(v == null ? null : fromDisplayWeight(v, unit))}
                />
              </Field>
              <Field label="體脂率（選填）">
                <NumberInput ariaLabel="體脂率" value={bodyFat} suffix="%" decimals={1} min={LIMITS.bodyFatPct[0]} max={LIMITS.bodyFatPct[1]} clamp={false} placeholder="不知道可略過" onChange={setBodyFat} />
              </Field>
            </div>
            {weightKg != null && !weightOk && (
              <p className="text-sm text-danger">
                體重請輸入 {fmt(toDisplayWeight(LIMITS.weightKg[0], unit))}–{fmt(toDisplayWeight(LIMITS.weightKg[1], unit))} {unit}
              </p>
            )}
            {!fatOk && <p className="text-sm text-danger">體脂率請輸入 2–70%，不知道可以留空</p>}
          </>
        )}

        {step === 2 && (
          <>
            <StepTitle title="平常的活動量" sub="包含工作與訓練。不確定就選「中度」，之後可依體重變化調整。" />
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="活動量">
              {ACTIVITY_LEVELS.map((a) => {
                const active = profile.activity === a.value;
                return (
                  <button
                    key={a.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setProfile({ ...profile, activity: a.value })}
                    className={`press flex min-h-14 items-center gap-3 rounded-lg border px-4 text-left ${active ? 'border-seam-strong bg-iron-2' : 'border-seam bg-iron hover:bg-iron-2'}`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${active ? 'border-chalk bg-chalk' : 'border-chalk-4'}`}>
                      {active && <Icon name="check" size={14} strokeWidth={2.5} className="text-on-chalk" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{a.label}</span>
                      <span className="block text-sm text-chalk-3">{a.hint}</span>
                    </span>
                    <span className="num text-sm text-chalk-4">×{a.value}</span>
                  </button>
                );
              })}
            </div>
            <Field label="重訓經驗">
              <Segmented
                ariaLabel="重訓經驗"
                value={profile.experience}
                options={[
                  { value: 'novice', label: '未滿 1 年' },
                  { value: 'intermediate', label: '1–3 年' },
                  { value: 'advanced', label: '3 年以上' },
                ]}
                onChange={(v) => {
                  setProfile({ ...profile, experience: v });
                  setTemplateId(v === 'novice' ? 'novice-fullbody-barbell' : 'upper-lower-4');
                }}
              />
            </Field>
          </>
        )}

        {step === 3 && targets && weightKg && (
          <>
            <StepTitle title="增肌目標" sub="少量熱量盈餘，盡量多長肌肉、少長脂肪" />
            <div className="card flex flex-col gap-4 p-5">
              <div>
                <p className="label">每日目標熱量</p>
                <p className="num text-display font-semibold">
                  {targets.kcal.toLocaleString()}
                  <span className="ml-1.5 text-h4 font-medium text-chalk-3">kcal</span>
                </p>
                <p className="mt-1 text-sm text-chalk-3">
                  估計消耗 {targets.tdee.toLocaleString()} ＋ 盈餘 {targets.surplus} kcal
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 border-t border-seam pt-4">
                <Macro label="蛋白質" g={targets.protein} color="var(--protein)" sub={`${fmt(targets.protein / weightKg)} g/kg`} />
                <Macro label="碳水" g={targets.carbs} color="var(--carbs)" />
                <Macro label="脂肪" g={targets.fat} color="var(--fat)" />
              </div>
            </div>
            <Field
              label="增重速度"
              hint={`約每週 +${fmt((weightKg * nutrition.weeklyGainPct) / 100, 2)} kg。新手建議每月增加體重的 1–1.5%。`}
            >
              <Segmented
                ariaLabel="增重速度"
                value={nutrition.weeklyGainPct}
                options={[
                  { value: 0.2, label: '保守' },
                  { value: 0.3, label: '標準' },
                  { value: 0.5, label: '積極' },
                ]}
                onChange={(v) => setNutrition({ ...nutrition, mode: 'rate', weeklyGainPct: v })}
              />
            </Field>
            {targets.warnings.map((w) => (
              <p key={w} className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
                {w}
              </p>
            ))}
            <p className="text-sm text-chalk-3">之後可在「設定」調整蛋白質、脂肪比例或直接指定熱量。</p>
          </>
        )}

        {step === 4 && (
          <>
            <StepTitle title="選一份課表" sub="照著練，App 會依你的表現自動建議下次的重量" />
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="課表">
              {PROGRAM_TEMPLATES.map((t) => {
                const active = templateId === t.id;
                const recommended = (profile.experience === 'novice') === (t.level === 'novice');
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTemplateId(t.id)}
                    className={`press flex flex-col gap-1 rounded-lg border p-4 text-left ${active ? 'border-seam-strong bg-iron-2' : 'border-seam bg-iron hover:bg-iron-2'}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 font-semibold">{t.name}</span>
                      {recommended && <span className="rounded-sm bg-go-soft px-2 py-0.5 text-cap font-medium text-go">適合你</span>}
                      <span className="num text-sm text-chalk-3">每週 {t.daysPerWeek} 天</span>
                    </span>
                    <span className="text-sm text-chalk-3">{t.description}</span>
                  </button>
                );
              })}
              <button
                type="button"
                role="radio"
                aria-checked={templateId === null}
                onClick={() => setTemplateId(null)}
                className={`press min-h-12 rounded-lg border px-4 text-left text-chalk-2 ${templateId === null ? 'border-seam-strong bg-iron-2' : 'border-seam'}`}
              >
                先不選，之後自己排
              </button>
            </div>
          </>
        )}
      </div>

      <div className="sticky bottom-0 flex gap-2 bg-floor pt-2">
        {step > 0 && (
          <Button size="lg" onClick={back} className="w-28">
            上一步
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button
            size="lg"
            variant="primary"
            block
            className="flex-1"
            disabled={(step === 0 && !agreed) || (step === 1 && !basicsValid)}
            onClick={next}
          >
            下一步
          </Button>
        ) : (
          <Button size="lg" variant="primary" block className="flex-1" disabled={saving} onClick={finish}>
            {saving ? '儲存中…' : '完成，開始使用'}
          </Button>
        )}
      </div>
    </div>
  );
}

function StepTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-h1 font-semibold">{title}</h1>
      {sub && <p className="text-base text-chalk-3">{sub}</p>}
    </div>
  );
}

function Macro({ label, g, color, sub }: { label: string; g: number; color: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex items-center gap-1.5 text-sm text-chalk-3">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="num text-h2 font-semibold">
        {g}
        <span className="ml-0.5 text-base font-medium text-chalk-3">g</span>
      </span>
      {sub && <span className="text-cap text-chalk-4">{sub}</span>}
    </div>
  );
}
