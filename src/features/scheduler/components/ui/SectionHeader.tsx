import type { ReactNode } from 'react';

export interface SectionHeaderProps {
  emoji?: string;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
}

export function SectionHeader({
  emoji,
  title,
  sub,
  right,
}: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-[18px] py-3.5 dark:border-slate-700">
      <div className="flex items-center gap-2">
        {emoji ? <span className="text-base leading-none">{emoji}</span> : null}
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </span>
        {sub ? (
          <span className="ml-1.5 text-xs text-slate-500 dark:text-slate-400">
            {sub}
          </span>
        ) : null}
      </div>
      {right}
    </div>
  );
}
