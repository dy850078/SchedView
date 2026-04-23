import { NextResponse } from 'next/server';
import { projectSyncRun } from '@/lib/projectors';
import { runSync } from '@/lib/sync';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const run = await runSync();
    return NextResponse.json(projectSyncRun(run));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: { code: 'SYNC_FAILED', message } },
      { status: 500 },
    );
  }
}
