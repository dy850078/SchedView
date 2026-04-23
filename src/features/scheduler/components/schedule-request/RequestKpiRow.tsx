import type { ScheduleRequest } from '../../types';
import { KpiTile } from '../ui/KpiTile';

export function RequestKpiRow({ request }: { request: ScheduleRequest }) {
  const placed = request.vm_count - request.unplaced_count;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <KpiTile label="Requested" value={request.vm_count} unit="VMs" />
      <KpiTile
        label="Placed"
        value={placed}
        unit={`/ ${request.vm_count}`}
        accentClassName="text-blue-700 dark:text-blue-400"
      />
      <KpiTile
        label="Unplaced"
        value={request.unplaced_count}
        unit="VMs"
        accentClassName={
          request.unplaced_count > 0
            ? 'text-red-600 dark:text-red-400'
            : undefined
        }
      />
      <KpiTile label="Solve Time" value={request.solve_time_seconds} unit="sec" />
    </div>
  );
}
