import { fmtTime } from '../../lib/format';
import type { ScheduleRequest } from '../../types';
import { Pill, type PillVariant } from '../ui/Pill';

const STATUS_VARIANT: Record<ScheduleRequest['status'], PillVariant> = {
  OPTIMAL: 'green',
  FEASIBLE: 'blue',
  INFEASIBLE: 'red',
  UNKNOWN: 'amber',
  MODEL_INVALID: 'red',
};

export function RequestHeader({ request }: { request: ScheduleRequest }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="m-0 font-mono text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {request.id}
          </h1>
          <Pill variant={STATUS_VARIANT[request.status]}>{request.status}</Pill>
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
          <MetaItem label="Cluster" value={request.cluster_id} />
          <MetaItem label="By" value={request.requested_by} />
          <MetaItem label="Submitted" value={fmtTime(request.submitted_at)} />
        </div>
      </div>

      <div className="flex gap-1.5">
        <Pill variant="indigo" mono>
          solve {request.solve_time_seconds}s
        </Pill>
        <Pill mono>{request.vm_count} VMs</Pill>
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <span>
      {label} :{' '}
      <span className="font-mono text-slate-700 dark:text-slate-300">
        {value}
      </span>
    </span>
  );
}
