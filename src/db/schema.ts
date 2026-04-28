import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const scheduleRequest = pgTable(
  'schedule_request',
  {
    id: text('id').primaryKey(),
    clusterId: text('cluster_id').notNull(),
    submittedAt: bigint('submitted_at', { mode: 'number' }).notNull(),
    status: text('status').notNull(),
    solverStatus: text('solver_status').notNull(),
    solveTimeSeconds: real('solve_time_seconds').notNull(),
    unplacedCount: integer('unplaced_count').notNull(),
    requestedBy: text('requested_by').notNull(),
    reason: text('reason'),
    syncedAt: bigint('synced_at', { mode: 'number' }).notNull(),
    deletedAt: bigint('deleted_at', { mode: 'number' }),
  },
  (t) => [
    index('idx_sr_cluster').on(t.clusterId),
    index('idx_sr_submitted').on(t.submittedAt),
    index('idx_sr_status').on(t.status),
  ],
);

export const schedulePlacement = pgTable(
  'schedule_placement',
  {
    id: serial('id').primaryKey(),
    scheduleRequestId: text('schedule_request_id')
      .notNull()
      .references(() => scheduleRequest.id, { onDelete: 'cascade' }),
    vmId: text('vm_id').notNull(),
    vmCpuCores: integer('vm_cpu_cores').notNull(),
    vmMemoryMb: integer('vm_memory_mb').notNull(),
    vmDiskGb: integer('vm_disk_gb').notNull(),
    vmGpuCount: integer('vm_gpu_count').notNull().default(0),
    nodeRole: text('node_role').notNull(),
    assignedBmId: text('assigned_bm_id'),
  },
  (t) => [
    uniqueIndex('uq_pl_request_vm').on(t.scheduleRequestId, t.vmId),
    index('idx_pl_request').on(t.scheduleRequestId),
    index('idx_pl_bm').on(t.assignedBmId),
  ],
);

export const baremetal = pgTable(
  'baremetal',
  {
    id: text('id').primaryKey(),
    site: text('site').notNull(),
    phase: text('phase').notNull(),
    datacenter: text('datacenter').notNull(),
    rack: text('rack').notNull(),
    unit: integer('unit').notNull(),
    rackHeight: integer('rack_height').notNull(),
    ag: text('ag').notNull(),
    totalCpuCores: integer('total_cpu_cores').notNull(),
    totalMemoryMb: integer('total_memory_mb').notNull(),
    totalDiskGb: integer('total_disk_gb').notNull(),
    totalGpuCount: integer('total_gpu_count').notNull().default(0),
    usedCpuCores: integer('used_cpu_cores').notNull(),
    usedMemoryMb: integer('used_memory_mb').notNull(),
    usedDiskGb: integer('used_disk_gb').notNull(),
    usedGpuCount: integer('used_gpu_count').notNull().default(0),
    bmRole: text('bm_role').notNull(),
    maxVmCount: integer('max_vm_count').notNull(),
    currentVmCount: integer('current_vm_count').notNull(),
    ipTypes: jsonb('ip_types').$type<string[]>().notNull(),
    snapshotAt: bigint('snapshot_at', { mode: 'number' }).notNull(),
  },
  (t) => [index('idx_bm_ag').on(t.ag), index('idx_bm_rack').on(t.rack)],
);

export const syncRun = pgTable('sync_run', {
  id: serial('id').primaryKey(),
  startedAt: bigint('started_at', { mode: 'number' }).notNull(),
  finishedAt: bigint('finished_at', { mode: 'number' }),
  status: text('status').notNull(),
  errorMessage: text('error_message'),
  recordsUpserted: integer('records_upserted').notNull().default(0),
  recordsSkipped: integer('records_skipped').notNull().default(0),
});

export type ScheduleRequestRow = typeof scheduleRequest.$inferSelect;
export type SchedulePlacementRow = typeof schedulePlacement.$inferSelect;
export type BaremetalRow = typeof baremetal.$inferSelect;
export type SyncRunRow = typeof syncRun.$inferSelect;
