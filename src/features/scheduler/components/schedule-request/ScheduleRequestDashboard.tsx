'use client';

import { useState } from 'react';
import {
  useScheduleRequests,
  type StatusFilter,
} from '../../hooks/useScheduleRequests';
import { useScheduleRequestDetail } from '../../hooks/useScheduleRequestDetail';
import { ConstraintsPanel } from './ConstraintsPanel';
import { PlacementMap } from './PlacementMap';
import { RequestHeader } from './RequestHeader';
import { RequestKpiRow } from './RequestKpiRow';
import { RequestListPanel } from './RequestListPanel';
import { SyncNowButton } from './SyncNowButton';

export interface ScheduleRequestDashboardProps {
  /** Optional: preselect a request (e.g. from URL). */
  initialRequestId?: string;
}

export function ScheduleRequestDashboard({
  initialRequestId,
}: ScheduleRequestDashboardProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(
    initialRequestId ?? null,
  );

  const { requests, isLoading: listLoading } = useScheduleRequests({
    search,
    status,
  });

  const effectiveId = selectedId ?? requests[0]?.id ?? null;

  const {
    data: placement,
    bmsByAg,
    assignedByBm,
    isLoading: detailLoading,
  } = useScheduleRequestDetail(effectiveId);

  return (
    <div className="grid h-full grid-cols-[340px_1fr] bg-slate-50 dark:bg-slate-900">
      <RequestListPanel
        requests={requests}
        selectedId={effectiveId}
        onSelect={setSelectedId}
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        headerSlot={<SyncNowButton />}
      />

      <main className="flex flex-col gap-3.5 overflow-auto p-5">
        {listLoading && !placement ? (
          <div className="py-10 text-center text-sm text-slate-400">
            Loading schedule requests…
          </div>
        ) : !placement ? (
          <div className="py-10 text-center text-sm text-slate-400">
            {detailLoading ? 'Loading placement…' : 'Select a request.'}
          </div>
        ) : (
          <>
            <RequestHeader request={placement.request} />

            {placement.request.reason ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                <span className="mr-1.5 font-bold">Reason:</span>
                {placement.request.reason}
              </div>
            ) : null}

            <RequestKpiRow request={placement.request} />

            <PlacementMap
              groups={bmsByAg}
              assignedByBm={assignedByBm}
              totalBaremetals={placement.baremetals.length}
            />

            <ConstraintsPanel />
          </>
        )}
      </main>
    </div>
  );
}
