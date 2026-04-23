import type {
  BaremetalRow,
  ScheduleRequestRow,
  SchedulePlacementRow,
  SyncRunRow,
} from '@/db/schema';
import type {
  Baremetal,
  ScheduleRequest,
  SchedulePlacement,
  SyncRun,
} from '@/features/scheduler/types';

export function projectScheduleRequest(
  row: ScheduleRequestRow,
  vmCount: number,
): ScheduleRequest {
  return {
    id: row.id,
    cluster_id: row.clusterId,
    submitted_at: row.submittedAt,
    status: row.status as ScheduleRequest['status'],
    solver_status: row.solverStatus as ScheduleRequest['solver_status'],
    solve_time_seconds: row.solveTimeSeconds,
    vm_count: vmCount,
    unplaced_count: row.unplacedCount,
    requested_by: row.requestedBy,
    reason: row.reason,
  };
}

export function projectPlacement(row: SchedulePlacementRow): SchedulePlacement {
  return {
    id: row.id,
    schedule_request_id: row.scheduleRequestId,
    vm_id: row.vmId,
    demand: {
      cpu_cores: row.vmCpuCores,
      memory_mb: row.vmMemoryMb,
      disk_gb: row.vmDiskGb,
      gpu_count: row.vmGpuCount,
    },
    node_role: row.nodeRole as SchedulePlacement['node_role'],
    assigned_bm_id: row.assignedBmId,
  };
}

export function projectBaremetal(row: BaremetalRow): Baremetal {
  return {
    id: row.id,
    total_capacity: {
      cpu_cores: row.totalCpuCores,
      memory_mb: row.totalMemoryMb,
      disk_gb: row.totalDiskGb,
      gpu_count: row.totalGpuCount,
    },
    used_capacity: {
      cpu_cores: row.usedCpuCores,
      memory_mb: row.usedMemoryMb,
      disk_gb: row.usedDiskGb,
      gpu_count: row.usedGpuCount,
    },
    topology: {
      site: row.site,
      phase: row.phase,
      datacenter: row.datacenter,
      rack: row.rack,
      unit: row.unit,
      rack_height: row.rackHeight,
      ag: row.ag,
    },
    bm_role: row.bmRole as Baremetal['bm_role'],
    max_vm_count: row.maxVmCount,
    current_vm_count: row.currentVmCount,
    ip_types: row.ipTypes as Baremetal['ip_types'],
  };
}

export function projectSyncRun(row: SyncRunRow): SyncRun {
  return {
    id: row.id,
    started_at: row.startedAt,
    finished_at: row.finishedAt,
    status: row.status as SyncRun['status'],
    error_message: row.errorMessage,
    records_upserted: row.recordsUpserted,
    records_skipped: row.recordsSkipped,
  };
}
