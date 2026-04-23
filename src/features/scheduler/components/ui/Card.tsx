import { clsx } from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className, ...rest }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-lg border border-slate-200 bg-white shadow-card dark:border-slate-700 dark:bg-slate-800',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
