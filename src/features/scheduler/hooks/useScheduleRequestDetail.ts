import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getScheduleRequestPlacement } from '../lib/api';
import type { Baremetal, SchedulePlacement } from '../types';

export interface BaremetalGroup {
  ag: string;
  baremetals: Baremetal[];
}

export interface BmDelta {
  cpu: number;
  mem: number;
  disk: number;
}

export function useScheduleRequestDetail(requestId: string | null) {
  const query = useQuery({
    queryKey: ['schedule-request', requestId],
    queryFn: () => getScheduleRequestPlacement(requestId!),
    enabled: !!requestId,
    staleTime: 5_000,
  });

  const bmsByAg = useMemo<BaremetalGroup[]>(() => {
    if (!query.data) return [];
    const map = new Map<string, Baremetal[]>();
    for (const bm of query.data.baremetals) {
      const arr = map.get(bm.topology.ag) ?? [];
      arr.push(bm);
      map.set(bm.topology.ag, arr);
    }
    return [...map.entries()].map(([ag, baremetals]) => ({ ag, baremetals }));
  }, [query.data]);

  const assignedByBm = useMemo<Record<string, SchedulePlacement[]>>(() => {
    if (!query.data) return {};
    const out: Record<string, SchedulePlacement[]> = {};
    for (const p of query.data.placements) {
      if (!p.assigned_bm_id) continue;
      (out[p.assigned_bm_id] ??= []).push(p);
    }
    return out;
  }, [query.data]);

  return { ...query, bmsByAg, assignedByBm };
}

export function sumDelta(placements: SchedulePlacement[]): BmDelta {
  return placements.reduce<BmDelta>(
    (a, p) => ({
      cpu: a.cpu + p.demand.cpu_cores,
      mem: a.mem + p.demand.memory_mb,
      disk: a.disk + p.demand.disk_gb,
    }),
    { cpu: 0, mem: 0, disk: 0 },
  );
}
