import { useState } from 'react';
import { WEIGHT_LABEL, WEIGHT_MEANINGS } from '../../core/training/logging';
import { LIMITS } from '../../db/limits';
import { saveMachineContext } from '../../db/repo/workouts';
import type { MachineContext, PlanItem, Workout } from '../../db/schemas';
import { Button } from '../../ui/Button';
import { Field, NumberInput, TextField, Toggle } from '../../ui/Fields';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/toast';

export function contextText(c?: MachineContext): string {
  return [c?.machine, c?.seat ? '座椅／靠墊 ' + c.seat : '', c?.grip ? '握把 ' + c.grip : '', c?.reminder].filter(Boolean).join(' · ');
}
export function MachineEditor({ workout, item, index, onClose }: { workout: Workout; item: PlanItem; index: number; onClose: () => void }) {
  const [value, setValue] = useState<MachineContext>(item.context ?? {});
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<number | null>(value.step ?? null);
  return <Sheet open title="器械設定" onClose={onClose} footer={<Button variant="primary" block disabled={busy || (step != null && (step < LIMITS.machineStep[0] || step > LIMITS.machineStep[1]))} onClick={async () => {
    setBusy(true);
    try { await saveMachineContext(workout.id, index, { ...value, step: step ?? undefined }, remember); onClose(); }
    catch { toast('設定儲存失敗，請重試', { tone: 'error' }); } finally { setBusy(false); }
  }}>儲存設定</Button>}>
    <div className="flex flex-col gap-4">
      <TextField label="器械名稱或編號" maxLength={60} value={value.machine ?? ''} onChange={(e) => setValue({ ...value, machine: e.target.value })} />
      <TextField label="座椅／靠墊刻度" maxLength={60} value={value.seat ?? ''} onChange={(e) => setValue({ ...value, seat: e.target.value })} />
      <TextField label="握把／握距" maxLength={80} value={value.grip ?? ''} onChange={(e) => setValue({ ...value, grip: e.target.value })} />
      <Field label="教練提醒"><textarea aria-label="教練提醒" className="field min-h-20 py-2" maxLength={500} value={value.reminder ?? ''} onChange={(e) => setValue({ ...value, reminder: e.target.value })} /></Field>
      <Field label="重量代表"><select className="field" aria-label="重量代表" value={value.weightMeaning ?? 'unknown'} onChange={(e) => setValue({ ...value, weightMeaning: e.target.value as MachineContext['weightMeaning'] })}>
        {WEIGHT_MEANINGS.map((k) => <option key={k} value={k}>{WEIGHT_LABEL[k]}</option>)}</select></Field>
      <Field label="面板單位"><select className="field" aria-label="面板單位" value={value.unit ?? ''} onChange={(e) => setValue({ ...value, unit: e.target.value ? e.target.value as 'kg' | 'lb' : undefined })}>
        <option value="">依 App 設定</option><option value="kg">kg</option><option value="lb">lb</option></select></Field>
      <Field label="每格重量（依面板單位，選填）"><NumberInput ariaLabel="每格重量" value={step} min={LIMITS.machineStep[0]} max={LIMITS.machineStep[1]} clamp={false} decimals={2} onChange={setStep} /></Field>
      <Toggle checked={remember} onChange={setRemember} label="下次沿用這些設定" hint="關閉時只改這一場；歷史紀錄保留當時設定。" />
    </div>
  </Sheet>;
}
