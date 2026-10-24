import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'go';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  // 粉筆白實心：畫面上唯一最強的動作
  primary: 'bg-chalk text-on-chalk hover:opacity-90 disabled:opacity-40',
  secondary: 'bg-iron-2 text-chalk border border-seam hover:bg-iron-3 disabled:opacity-40',
  ghost: 'text-chalk-2 hover:bg-iron-2 hover:text-chalk disabled:opacity-40',
  danger: 'bg-danger-soft text-danger hover:brightness-110 disabled:opacity-40',
  go: 'bg-go text-on-chalk hover:brightness-110 disabled:opacity-40',
};

const SIZE: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-sm',
  md: 'h-11 px-4 text-base gap-2 rounded-md',
  lg: 'h-14 px-5 text-h4 gap-2 rounded-lg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  block?: boolean;
  children?: ReactNode;
}

export function Button({ variant = 'secondary', size = 'md', icon, iconRight, block, className = '', children, type = 'button', ...rest }: ButtonProps) {
  const iconSize = size === 'lg' ? 22 : size === 'sm' ? 16 : 18;
  return (
    <button
      type={type}
      className={`press inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap select-none disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={iconSize} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize} />}
    </button>
  );
}

/** 只有圖示的按鈕，點擊範圍至少 44px */
export function IconButton({
  icon,
  label,
  variant = 'ghost',
  className = '',
  size = 44,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { icon: IconName; label: string; variant?: Variant; size?: number }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`press inline-flex shrink-0 items-center justify-center rounded-md ${VARIANT[variant]} ${className}`}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.45)} />
    </button>
  );
}
