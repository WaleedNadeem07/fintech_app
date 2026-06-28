import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type Variant =
  | 'default'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'purple'
  | 'pink'
  | 'orange';

const variants: Record<Variant, string> = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-700',
  error: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
  info: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  pink: 'bg-pink-100 text-pink-700',
  orange: 'bg-orange-100 text-orange-700',
};

interface BadgeProps {
  variant?: Variant;
  className?: string;
  children: ReactNode;
}

export function Badge({ variant = 'default', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function categoryVariant(category: string): Variant {
  const map: Record<string, Variant> = {
    'Food & Dining': 'success',
    Transport: 'info',
    Bills: 'orange',
    Shopping: 'purple',
    Entertainment: 'pink',
    Salary: 'success',
    Transfers: 'default',
    Other: 'default',
  };
  return map[category] ?? 'default';
}
