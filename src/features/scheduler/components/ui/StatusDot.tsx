import { clsx } from 'clsx';
import type { SolverStatus } from '../../types';

const COLORS: Record<SolverStatus, string> = {
  OPTIMAL: 'bg-emerald-500',
  FEASIBLE: 'bg-blue-500',
  INFEASIBLE: 'bg-red-500',
  UNKNOWN: 'bg-amber-500',
  MODEL_INVALID: 'bg-red-600',
};

export function StatusDot({ status }: { status: SolverStatus }) {
  return (
    <span
      aria-label={status}
      className={clsx('inline-block h-2 w-2 rounded-full', COLORS[status])}
    />
  );
}
