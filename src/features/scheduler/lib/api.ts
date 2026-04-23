import {
  PlacementResultSchema,
  ScheduleRequestSchema,
  type PlacementResult,
  type ScheduleRequest,
} from '../types';

const BASE = process.env.NEXT_PUBLIC_SCHEDULER_API ?? '/api';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} — ${path}`);
  }
  return res.json() as Promise<T>;
}

export async function listScheduleRequests(): Promise<ScheduleRequest[]> {
  const raw = await getJson<unknown>('/schedule-requests');
  return ScheduleRequestSchema.array().parse(raw);
}

export async function getScheduleRequestPlacement(
  id: string,
): Promise<PlacementResult> {
  const raw = await getJson<unknown>(`/schedule-requests/${id}/placement`);
  return PlacementResultSchema.parse(raw);
}

export async function triggerSync(): Promise<void> {
  const res = await fetch(`${BASE}/sync`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(body?.error?.message ?? `sync failed (${res.status})`);
  }
}

export async function fetchSyncStatus(): Promise<{
  in_flight: boolean;
  last: {
    id: number;
    started_at: number;
    finished_at: number | null;
    status: string;
    records_upserted: number;
    records_skipped: number;
    error_message: string | null;
  } | null;
}> {
  const res = await fetch(`${BASE}/sync/status`, { credentials: 'include' });
  if (!res.ok) throw new Error(`sync/status failed (${res.status})`);
  return res.json();
}
