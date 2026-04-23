import { eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { baremetal, schedulePlacement, scheduleRequest } from '@/db/schema';
import {
  projectBaremetal,
  projectPlacement,
  projectScheduleRequest,
} from '@/lib/projectors';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const [requestRow] = db
    .select()
    .from(scheduleRequest)
    .where(eq(scheduleRequest.id, id))
    .all();

  if (!requestRow) {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: `schedule request ${id} not found`,
        },
      },
      { status: 404 },
    );
  }

  const placements = db
    .select()
    .from(schedulePlacement)
    .where(eq(schedulePlacement.scheduleRequestId, id))
    .all();

  const bmIds = Array.from(
    new Set(
      placements
        .map((p) => p.assignedBmId)
        .filter((v): v is string => v !== null),
    ),
  );
  const baremetals =
    bmIds.length > 0
      ? db.select().from(baremetal).where(inArray(baremetal.id, bmIds)).all()
      : [];

  return NextResponse.json({
    request: projectScheduleRequest(requestRow, placements.length),
    placements: placements.map(projectPlacement),
    baremetals: baremetals.map(projectBaremetal),
  });
}
