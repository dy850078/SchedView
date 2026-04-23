import { pct } from '../../lib/format';

export interface ResourceBarProps {
  /** Current used (baseline, rendered in slate). */
  used: number;
  /** Total capacity. */
  total: number;
  /** Additional demand from this request (rendered as indigo overlay on top of used). */
  delta?: number;
}

/**
 * Stacked capacity bar: slate "used" segment + indigo "new demand" segment.
 * The indigo segment is clipped to remaining headroom so it never exceeds 100%.
 */
export function ResourceBar({ used, total, delta = 0 }: ResourceBarProps) {
  const usedPct = pct(used, total);
  const deltaPct = pct(delta, total);
  const cappedDelta = Math.min(deltaPct, 100 - usedPct);

  return (
    <div className="relative h-2 overflow-hidden rounded bg-slate-100 dark:bg-slate-700">
      <div
        className="absolute inset-y-0 left-0 bg-slate-500/60 dark:bg-slate-400/60"
        style={{ width: `${usedPct}%` }}
      />
      {delta > 0 ? (
        <div
          className="absolute inset-y-0 bg-indigo-600 ring-1 ring-inset ring-white/50 dark:bg-indigo-500"
          style={{ left: `${usedPct}%`, width: `${cappedDelta}%` }}
        />
      ) : null}
    </div>
  );
}
