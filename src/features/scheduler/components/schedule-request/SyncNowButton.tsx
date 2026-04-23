'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { ago } from '../../lib/format';
import { fetchSyncStatus, triggerSync } from '../../lib/api';

export function SyncNowButton() {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ['sync-status'],
    queryFn: fetchSyncStatus,
    refetchInterval: (q) =>
      q.state.data?.in_flight ? 1_500 : 15_000,
  });

  const mutation = useMutation({
    mutationFn: triggerSync,
    onSuccess: () => {
      status.refetch();
      queryClient.invalidateQueries({ queryKey: ['schedule-requests'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-request'] });
      toast.success('Sync complete');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Sync failed: ${msg}`);
    },
  });

  const busy = status.data?.in_flight || mutation.isPending;
  const last = status.data?.last;
  const lastSuccess = last?.status === 'success' && last.finished_at !== null;

  const label = busy
    ? 'Syncing…'
    : lastSuccess && last?.finished_at
      ? `Synced ${ago(last.finished_at)}`
      : 'Sync now';

  return (
    <button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={busy}
      className={clsx(
        'rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors',
        busy
          ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
          : 'border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900',
      )}
      title={
        last?.status === 'failed' && last.error_message
          ? `Last sync failed: ${last.error_message}`
          : undefined
      }
    >
      {busy ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          {label}
        </span>
      ) : (
        label
      )}
    </button>
  );
}
