import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon';

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-chalk-2">
        {label}
      </label>
      {children}
      {error ? <p className="text-sm text-danger">{error}</p> : hint ? <p className="text-sm text-chalk-3">{hint}</p> : null}
    </div>
  );
}

export function TextField({ label, hint, error, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <input id={id} className="field" {...rest} />
    </Field>
  );
}

function fmtInput(v: number | null, decimals: number): string {
  if (v == null || !Number.isFinite(v)) return '';
  return String(Number(v.toFixed(decimals)));
}

export interface NumberInputProps {
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
  suffix?: string;
  placeholder?: string;
  /** 顯示 −／＋ 按鈕 */
  stepper?: boolean;
  size?: 'md' | 'lg';
  ariaLabel?: string;
  id?: string;
  className?: string;
  /**
   * false：超出範圍時不自動改成上下限（避免 7.5 被悄悄改成 20），
   * 照實回傳數值並標紅，由表單決定能不能儲存
   */
  clamp?: boolean;
  /**
   * 「確定」的時機：離開欄位、或按 −／＋。需要存檔的欄位用這個，不要在 onChange 每打一個字就存
   * （逐字輸入 25 時，中間的 2 會先被存進去）
   */
  onCommit?: (v: number | null) => void;
}

/**
 * 數字輸入：用 text + inputMode=decimal，手機跳出數字鍵盤，也接受全形數字與逗號小數點。
 * 編輯中保留使用者打的字串，離開欄位才正規化。
 */
export function NumberInput({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 100000,
  decimals = 2,
  suffix,
  placeholder,
  stepper = false,
  size = 'md',
  ariaLabel,
  id,
  className = '',
  clamp = true,
  onCommit,
}: NumberInputProps) {
  const [text, setText] = useState(fmtInput(value, decimals));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(fmtInput(value, decimals));
  }, [value, decimals, focused]);

  const parse = (s: string): number | null => {
    const t = s.normalize('NFKC').replace(',', '.').trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  const clampV = (n: number) => Math.min(max, Math.max(min, n));
  const bump = (dir: 1 | -1) => {
    const base = value ?? 0;
    const next = clampV(Number((base + dir * step).toFixed(6)));
    onChange(next);
    onCommit?.(next);
    setText(fmtInput(next, decimals));
  };

  const big = size === 'lg';
  const outOfRange = !clamp && value != null && (value < min || value > max);
  return (
    <div className={`flex min-w-0 items-stretch gap-1.5 ${className}`}>
      {stepper && (
        <button
          type="button"
          aria-label="減少"
          onClick={() => bump(-1)}
          className={`press flex shrink-0 items-center justify-center rounded-md border border-seam bg-iron-2 text-chalk-2 hover:bg-iron-3 ${big ? 'w-14' : 'w-11'}`}
        >
          <Icon name="minus" size={big ? 22 : 18} />
        </button>
      )}
      <div className="relative min-w-0 flex-1">
        <input
          id={id}
          aria-label={ariaLabel}
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          onFocus={(e) => {
            setFocused(true);
            e.currentTarget.select();
          }}
          aria-invalid={outOfRange || undefined}
          onBlur={() => {
            setFocused(false);
            const n = parse(text);
            const v = n == null ? null : clamp ? clampV(n) : n;
            onChange(v);
            onCommit?.(v);
            setText(fmtInput(v, decimals));
          }}
          onChange={(e) => {
            setText(e.target.value);
            const n = parse(e.target.value);
            if (n != null && (!clamp || (n >= min && n <= max))) onChange(n);
            if (e.target.value.trim() === '') onChange(null);
          }}
          className={`field num w-full text-center font-semibold placeholder:text-sm placeholder:font-normal placeholder:text-chalk-4 ${big ? 'h-14 text-h2' : 'text-h4'} ${suffix ? 'pr-9' : ''} ${outOfRange ? 'border-danger' : ''}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-chalk-3">{suffix}</span>
        )}
      </div>
      {stepper && (
        <button
          type="button"
          aria-label="增加"
          onClick={() => bump(1)}
          className={`press flex shrink-0 items-center justify-center rounded-md border border-seam bg-iron-2 text-chalk-2 hover:bg-iron-3 ${big ? 'w-14' : 'w-11'}`}
        >
          <Icon name="plus" size={big ? 22 : 18} />
        </button>
      )}
    </div>
  );
}

export function NumberField({ label, hint, error, ...rest }: NumberInputProps & { label: string; hint?: ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <NumberInput id={id} {...rest} />
    </Field>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'md',
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (v: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex min-w-0 gap-1 rounded-md border border-seam bg-well p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`press min-w-0 flex-1 truncate rounded-sm px-2 font-medium ${size === 'sm' ? 'h-8 text-sm' : 'h-9 text-base'} ${
              active ? 'bg-iron-3 text-chalk' : 'text-chalk-3 hover:text-chalk-2'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-base text-chalk">{label}</span>
        {hint && <span className="block text-sm text-chalk-3">{hint}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-7 w-12 rounded-full border border-seam bg-well transition-colors peer-checked:bg-go peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)]" />
        <span className="pointer-events-none absolute top-1 left-1 h-5 w-5 rounded-full bg-chalk-2 transition-transform duration-150 peer-checked:translate-x-5 peer-checked:bg-on-chalk" />
      </span>
    </label>
  );
}
