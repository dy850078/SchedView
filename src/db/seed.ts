import { runSync } from '@/lib/sync';

async function main() {
  process.env.INVENTORY_MODE = process.env.INVENTORY_MODE ?? 'mock';
  console.log(`[seed] INVENTORY_MODE=${process.env.INVENTORY_MODE}`);
  const run = await runSync();
  console.log('[seed] done:', {
    id: run.id,
    status: run.status,
    upserted: run.recordsUpserted,
    skipped: run.recordsSkipped,
    durationMs: (run.finishedAt ?? 0) - run.startedAt,
  });
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
