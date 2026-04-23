import { mib } from '../../lib/format';
import type { Baremetal, SchedulePlacement } from '../../types';
import { sumDelta } from '../../hooks/useScheduleRequestDetail';
import { Pill } from '../ui/Pill';
import { ResourceBar } from '../ui/ResourceBar';

export interface BaremetalCardProps {
  baremetal: Baremetal;
  assignedPlacements: SchedulePlacement[];
}

interface Quadrant {
  key: 'CPU' | 'MEM' | 'DISK';
  used: number;
  total: number;
  delta: number;
  fmt: (n: number) => string;
}

export function BaremetalCard({
  baremetal,
  assignedPlacements,
}: BaremetalCardProps) {
  const delta = sumDelta(assignedPlacements);
  const quadrants: Quadrant[] = [
    {
      key: 'CPU',
      used: baremetal.used_capacity.cpu_cores,
      total: baremetal.total_capacity.cpu_cores,
      delta: delta.cpu,
      fmt: (n) => `${n}c`,
    },
    {
      key: 'MEM',
      used: baremetal.used_capacity.memory_mb,
      total: baremetal.total_capacity.memory_mb,
      delta: delta.mem,
      fmt: (n) => mib(n),
    },
    {
      key: 'DISK',
      used: baremetal.used_capacity.disk_gb,
      total: baremetal.total_capacity.disk_gb,
      delta: delta.disk,
      fmt: (n) => `${n}G`,
    },
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm leading-none">🖥️</span>
          <span className="font-mono text-xs font-medium text-slate-900 dark:text-slate-100">
            {baremetal.id}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            · {baremetal.topology.rack}
          </span>
        </div>
        <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
          {baremetal.current_vm_count}/{baremetal.max_vm_count} slots · +
          {assignedPlacements.length}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {quadrants.map((q) => (
          <div key={q.key}>
            <div className="mb-0.5 flex items-baseline justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {q.key}
              </span>
              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                {q.fmt(q.used)}
                {q.delta > 0 ? (
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {' '}
                    +{q.fmt(q.delta)}
                  </span>
                ) : null}{' '}
                / {q.fmt(q.total)}
              </span>
            </div>
            <ResourceBar used={q.used} total={q.total} delta={q.delta} />
          </div>
        ))}
      </div>

      {assignedPlacements.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1 border-t border-dashed border-slate-200 pt-2.5 dark:border-slate-700">
          {assignedPlacements.map((p) => (
            <Pill key={p.id} variant="blue" mono>
              + {p.vm_id}
              <span className="ml-1.5 text-[10px] opacity-70">
                {p.node_role} · {p.demand.cpu_cores}c/
                {mib(p.demand.memory_mb)}/{p.demand.disk_gb}G
              </span>
            </Pill>
          ))}
        </div>
      ) : null}
    </div>
  );
}
