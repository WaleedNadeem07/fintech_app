import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface Props {
  className?: string;
  children: ReactNode;
}

export function Card({ className, children }: Props) {
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: Props) {
  return <div className={cn('px-6 pt-6 pb-0', className)}>{children}</div>;
}

export function CardTitle({ className, children }: Props) {
  return (
    <h3
      className={cn(
        'text-xs font-semibold text-slate-500 uppercase tracking-wider',
        className,
      )}
    >
      {children}
    </h3>
  );
}

export function CardContent({ className, children }: Props) {
  return <div className={cn('p-6', className)}>{children}</div>;
}
