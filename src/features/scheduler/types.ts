import { z } from 'zod';
import {
  BmRoleSchema,
  IpTypeSchema,
  SolverStatusSchema,
} from '@/lib/inventory-types';

export {
  BmRoleSchema,
  IpTypeSchema,
  SolverStatusSchema,
  type BmRole,
  type IpType,
  type SolverStatus,
} from '@/lib/inventory-types';

export const CapacitySchema = z.object({
  cpu_cores: z.number().int().nonnegative(),
  memory_mb: z.number().int().nonnegative(),
  disk_gb: z.number().int().nonnegative(),
  gpu_count: z.number().int().nonnegative(),
});
export type Capacity = z.infer<typeof CapacitySchema>;

export const TopologySchema = z.object({
  site: z.string(),
  phase: z.string(),
  datacenter: z.string(),
  rack: z.string(),
  unit: z.number().int().positive(),
  rack_height: z.number().int().positive(),
  ag: z.string(),
});
export type Topology = z.infer<typeof TopologySchema>;

export const BaremetalSchema = z.object({
  id: z.string(),
  total_capacity: CapacitySchema,
  used_capacity: CapacitySchema,
  topology: TopologySchema,
  bm_role: BmRoleSchema,
  max_vm_count: z.number().int().positive(),
  current_vm_count: z.number().int().nonnegative(),
  ip_types: z.array(IpTypeSchema),
});
export type Baremetal = z.infer<typeof BaremetalSchema>;

export const VmDemandSchema = z.object({
  cpu_cores: z.number().int().positive(),
  memory_mb: z.number().int().positive(),
  disk_gb: z.number().int().positive(),
  gpu_count: z.number().int().nonnegative(),
});
export type VmDemand = z.infer<typeof VmDemandSchema>;

export const SchedulePlacementSchema = z.object({
  id: z.number(),
  schedule_request_id: z.string(),
  vm_id: z.string(),
  demand: VmDemandSchema,
  node_role: BmRoleSchema,
  assigned_bm_id: z.string().nullable(),
});
export type SchedulePlacement = z.infer<typeof SchedulePlacementSchema>;

/** List-endpoint shape: no VMs (see placements[]); includes a computed vm_count. */
export const ScheduleRequestSchema = z.object({
  id: z.string(),
  cluster_id: z.string(),
  submitted_at: z.number(),
  status: SolverStatusSchema,
  solver_status: SolverStatusSchema,
  solve_time_seconds: z.number().nonnegative(),
  vm_count: z.number().int().nonnegative(),
  unplaced_count: z.number().int().nonnegative(),
  requested_by: z.string(),
  reason: z.string().nullable(),
});
export type ScheduleRequest = z.infer<typeof ScheduleRequestSchema>;

export const PlacementResultSchema = z.object({
  request: ScheduleRequestSchema,
  placements: z.array(SchedulePlacementSchema),
  baremetals: z.array(BaremetalSchema),
});
export type PlacementResult = z.infer<typeof PlacementResultSchema>;

export const SyncRunSchema = z.object({
  id: z.number(),
  started_at: z.number(),
  finished_at: z.number().nullable(),
  status: z.enum(['running', 'success', 'failed']),
  error_message: z.string().nullable(),
  records_upserted: z.number().int().nonnegative(),
  records_skipped: z.number().int().nonnegative(),
});
export type SyncRun = z.infer<typeof SyncRunSchema>;

export const SyncStatusSchema = z.object({
  in_flight: z.boolean(),
  last: SyncRunSchema.nullable(),
});
export type SyncStatus = z.infer<typeof SyncStatusSchema>;
