import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { Card } from './Card';

export interface KpiTileProps {
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  sub?: ReactNode;
  accentClassName?: string;
}

export function KpiTile({
  label,
  value,
  unit,
  sub,
  accentClassName,
}: KpiTileProps) {
  return (
    <Card className="flex flex-col gap-1.5 px-[18px] py-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={clsx(
            'font-mono text-[28px] font-bold tracking-tight',
            accentClassName ?? 'text-slate-900 dark:text-slate-100',
          )}
        >
          {value}
        </span>
        {unit ? (
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {unit}
          </span>
        ) : null}
      </div>
      {sub ? (
        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          {sub}
        </div>
      ) : null}
    </Card>
  );
}
