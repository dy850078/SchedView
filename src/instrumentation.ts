export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.VERCEL) return; // Vercel Cron owns the trigger on Vercel.

  const g = globalThis as { __schedview_sync_timer__?: NodeJS.Timeout };
  if (g.__schedview_sync_timer__) return;

  const { runSync } = await import('./lib/sync');
  runSync().catch((err) => console.error('[sync] initial run failed:', err));

  g.__schedview_sync_timer__ = setInterval(
    () => {
      runSync().catch((err) => console.error('[sync] periodic run failed:', err));
    },
    5 * 60 * 1000,
  );
}
