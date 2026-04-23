'use client';

import { clsx } from 'clsx';
import { ago } from '../../lib/format';
import type { ScheduleRequest, SolverStatus } from '../../types';
import { StatusDot } from '../ui/StatusDot';
import type { StatusFilter } from '../../hooks/useScheduleRequests';

const STATUS_OPTIONS: StatusFilter[] = [
  'all',
  'OPTIMAL',
  'FEASIBLE',
  'INFEASIBLE',
  'UNKNOWN',
];

export interface RequestListPanelProps {
  requests: ScheduleRequest[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  status: StatusFilter;
  onStatusChange: (v: StatusFilter) => void;
  headerSlot?: React.ReactNode;
}

export function RequestListPanel({
  requests,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  status,
  onStatusChange,
  headerSlot,
}: RequestListPanelProps) {
  return (
    <aside className="flex h-full flex-col overflow-hidden border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="border-b border-slate-100 px-[18px] py-3.5 dark:border-slate-700">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none">📋</span>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Schedule Requests
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                調度申請單
              </div>
            </div>
          </div>
          {headerSlot}
        </div>

        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜尋 req-id / cluster / user..."
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-xs text-slate-900 shadow-inner outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />

        <div className="mt-2 flex flex-wrap gap-1">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStatusChange(s)}
              className={clsx(
                'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                status === s
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {requests.map((r) => (
          <RequestRow
            key={r.id}
            request={r}
            selected={r.id === selectedId}
            onClick={() => onSelect(r.id)}
          />
        ))}
        {requests.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs italic text-slate-400">
            No requests match.
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function RequestRow({
  request,
  selected,
  onClick,
}: {
  request: ScheduleRequest;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'block w-full border-b border-l-[3px] border-b-slate-100 px-4 py-2.5 text-left transition-colors dark:border-b-slate-700',
        selected
          ? 'border-l-blue-500 bg-blue-50/70 dark:bg-blue-950/40'
          : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-700/50',
      )}
    >
      <div className="mb-0.5 flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
          {request.id}
        </span>
        <StatusDot status={request.status as SolverStatus} />
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span className="font-mono">{request.cluster_id}</span>
        <span>{ago(request.submitted_at)}</span>
      </div>
      <div className="mt-1 flex gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
        <span>{request.vm_count} VMs</span>
        <span>·</span>
        <span className="font-mono">{request.solve_time_seconds}s</span>
        {request.unplaced_count > 0 ? (
          <>
            <span>·</span>
            <span className="text-red-600 dark:text-red-400">
              {request.unplaced_count} unplaced
            </span>
          </>
        ) : null}
      </div>
    </button>
  );
}
