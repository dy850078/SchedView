import { count, desc, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { schedulePlacement, scheduleRequest } from '@/db/schema';
import { projectScheduleRequest } from '@/lib/projectors';

export const runtime = 'nodejs';

export async function GET() {
  const rows = await db
    .select()
    .from(scheduleRequest)
    .where(isNull(scheduleRequest.deletedAt))
    .orderBy(desc(scheduleRequest.submittedAt));

  const countsBySr = await db
    .select({
      scheduleRequestId: schedulePlacement.scheduleRequestId,
      c: count(),
    })
    .from(schedulePlacement)
    .groupBy(schedulePlacement.scheduleRequestId);
  const countMap = new Map(countsBySr.map((r) => [r.scheduleRequestId, r.c]));

  const out = rows.map((r) =>
    projectScheduleRequest(r, countMap.get(r.id) ?? 0),
  );
  return NextResponse.json(out);
}
