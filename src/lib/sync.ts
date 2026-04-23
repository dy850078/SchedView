import { and, desc, eq, isNull, notInArray } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  baremetal,
  schedulePlacement,
  scheduleRequest,
  syncRun,
  type SyncRunRow,
} from '@/db/schema';
import { createInventoryClient } from './inventory-client';
import {
  RawBaremetalSchema,
  RawScheduleRequestSchema,
  type RawBaremetal,
  type RawScheduleRequest,
} from './inventory-types';

let inFlight: Promise<SyncRunRow> | null = null;

export function isSyncInFlight(): boolean {
  return inFlight !== null;
}

export function runSync(): Promise<SyncRunRow> {
  if (inFlight) return inFlight;
  inFlight = doSync().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function lastSyncRun(): SyncRunRow | null {
  const rows = db
    .select()
    .from(syncRun)
    .orderBy(desc(syncRun.startedAt))
    .limit(1)
    .all();
  return rows[0] ?? null;
}

async function doSync(): Promise<SyncRunRow> {
  const startedAt = Date.now();
  const [run] = db
    .insert(syncRun)
    .values({ startedAt, status: 'running' })
    .returning()
    .all();

  try {
    const client = createInventoryClient();
    const [rawRequests, rawBaremetals] = await Promise.all([
      client.listScheduleRequests(),
      client.listBaremetals(),
    ]);

    const validRequests: RawScheduleRequest[] = [];
    const validBaremetals: RawBaremetal[] = [];
    let skipped = 0;

    for (const r of rawRequests) {
      const parsed = RawScheduleRequestSchema.safeParse(r);
      if (parsed.success) validRequests.push(parsed.data);
      else {
        skipped++;
        console.warn(
          '[sync] skipping invalid ScheduleRequest:',
          parsed.error.issues,
        );
      }
    }
    for (const b of rawBaremetals) {
      const parsed = RawBaremetalSchema.safeParse(b);
      if (parsed.success) validBaremetals.push(parsed.data);
      else {
        skipped++;
        console.warn(
          '[sync] skipping invalid Baremetal:',
          parsed.error.issues,
        );
      }
    }

    const syncedAt = Date.now();
    let upserted = 0;

    db.transaction((tx) => {
      for (const bm of validBaremetals) {
        upsertBaremetal(tx, bm, syncedAt);
        upserted++;
      }
      for (const req of validRequests) {
        upsertRequest(tx, req, syncedAt);
        upserted++;
      }
      const seenIds = validRequests.map((r) => r.id);
      if (seenIds.length > 0) {
        tx.update(scheduleRequest)
          .set({ deletedAt: syncedAt })
          .where(
            and(
              notInArray(scheduleRequest.id, seenIds),
              isNull(scheduleRequest.deletedAt),
            ),
          )
          .run();
      }
    });

    const [updated] = db
      .update(syncRun)
      .set({
        finishedAt: Date.now(),
        status: 'success',
        recordsUpserted: upserted,
        recordsSkipped: skipped,
      })
      .where(eq(syncRun.id, run!.id))
      .returning()
      .all();
    return updated!;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[sync] failed:', err);
    const [updated] = db
      .update(syncRun)
      .set({
        finishedAt: Date.now(),
        status: 'failed',
        errorMessage,
      })
      .where(eq(syncRun.id, run!.id))
      .returning()
      .all();
    return updated!;
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function upsertBaremetal(
  tx: Tx,
  bm: RawBaremetal,
  syncedAt: number,
): void {
  const values = {
    id: bm.id,
    site: bm.topology.site,
    phase: bm.topology.phase,
    datacenter: bm.topology.datacenter,
    rack: bm.topology.rack,
    unit: bm.topology.unit,
    rackHeight: bm.topology.rack_height,
    ag: bm.topology.ag,
    totalCpuCores: bm.total_capacity.cpu_cores,
    totalMemoryMb: bm.total_capacity.memory_mb,
    totalDiskGb: bm.total_capacity.disk_gb,
    totalGpuCount: bm.total_capacity.gpu_count,
    usedCpuCores: bm.used_capacity.cpu_cores,
    usedMemoryMb: bm.used_capacity.memory_mb,
    usedDiskGb: bm.used_capacity.disk_gb,
    usedGpuCount: bm.used_capacity.gpu_count,
    bmRole: bm.bm_role,
    maxVmCount: bm.max_vm_count,
    currentVmCount: bm.current_vm_count,
    ipTypes: bm.ip_types,
    snapshotAt: syncedAt,
  };
  const { id: _id, ...updateSet } = values;
  tx.insert(baremetal)
    .values(values)
    .onConflictDoUpdate({ target: baremetal.id, set: updateSet })
    .run();
}

function upsertRequest(
  tx: Tx,
  req: RawScheduleRequest,
  syncedAt: number,
): void {
  const values = {
    id: req.id,
    clusterId: req.cluster_id,
    submittedAt: req.submitted_at,
    status: req.status,
    solverStatus: req.solver_status,
    solveTimeSeconds: req.solve_time_seconds,
    unplacedCount: req.unplaced_count,
    requestedBy: req.requested_by,
    reason: req.reason,
    syncedAt,
    deletedAt: null as number | null,
  };
  const { id: _id, ...updateSet } = values;
  tx.insert(scheduleRequest)
    .values(values)
    .onConflictDoUpdate({ target: scheduleRequest.id, set: updateSet })
    .run();

  tx.delete(schedulePlacement)
    .where(eq(schedulePlacement.scheduleRequestId, req.id))
    .run();

  if (req.vms.length > 0) {
    tx.insert(schedulePlacement)
      .values(
        req.vms.map((vm) => ({
          scheduleRequestId: req.id,
          vmId: vm.id,
          vmCpuCores: vm.demand.cpu_cores,
          vmMemoryMb: vm.demand.memory_mb,
          vmDiskGb: vm.demand.disk_gb,
          vmGpuCount: vm.demand.gpu_count,
          nodeRole: vm.node_role,
          assignedBmId: vm.assigned_bm,
        })),
      )
      .run();
  }
}
