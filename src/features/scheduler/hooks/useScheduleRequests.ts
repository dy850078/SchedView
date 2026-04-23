import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { listScheduleRequests } from '../lib/api';
import type { ScheduleRequest, SolverStatus } from '../types';

export type StatusFilter = 'all' | SolverStatus;

export interface RequestsQuery {
  search: string;
  status: StatusFilter;
}

export function useScheduleRequests(filters: RequestsQuery) {
  const query = useQuery({
    queryKey: ['schedule-requests'],
    queryFn: listScheduleRequests,
    refetchInterval: 5_000,
    staleTime: 2_000,
  });

  const filtered = useMemo(() => {
    const data = query.data ?? [];
    const needle = filters.search.trim().toLowerCase();
    return data
      .filter((r) => filters.status === 'all' || r.status === filters.status)
      .filter(
        (r) =>
          !needle ||
          r.id.toLowerCase().includes(needle) ||
          r.cluster_id.toLowerCase().includes(needle) ||
          r.requested_by.toLowerCase().includes(needle),
      )
      .sort(
        (a: ScheduleRequest, b: ScheduleRequest) =>
          b.submitted_at - a.submitted_at,
      );
  }, [query.data, filters.search, filters.status]);

  return { ...query, requests: filtered };
}
