import { NextResponse } from 'next/server';
import { projectSyncRun } from '@/lib/projectors';
import { isSyncInFlight, lastSyncRun } from '@/lib/sync';

export const runtime = 'nodejs';

export async function GET() {
  const last = await lastSyncRun();
  return NextResponse.json({
    in_flight: isSyncInFlight(),
    last: last ? projectSyncRun(last) : null,
  });
}
