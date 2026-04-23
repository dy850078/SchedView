import { z } from 'zod';

export const BmRoleSchema = z.enum(['worker', 'master', 'infra', 'l4lb']);
export type BmRole = z.infer<typeof BmRoleSchema>;

export const IpTypeSchema = z.enum(['routable', 'non-routable']);
export type IpType = z.infer<typeof IpTypeSchema>;

export const SolverStatusSchema = z.enum([
  'OPTIMAL',
  'FEASIBLE',
  'INFEASIBLE',
  'UNKNOWN',
  'MODEL_INVALID',
]);
export type SolverStatus = z.infer<typeof SolverStatusSchema>;

const RawCapacitySchema = z.object({
  cpu_cores: z.number().int().nonnegative(),
  memory_mb: z.number().int().nonnegative(),
  disk_gb: z.number().int().nonnegative(),
  gpu_count: z.number().int().nonnegative().default(0),
});

const RawTopologySchema = z.object({
  site: z.string(),
  phase: z.string(),
  datacenter: z.string(),
  rack: z.string(),
  unit: z.number().int().positive(),
  rack_height: z.number().int().positive(),
  ag: z.string(),
});

export const RawBaremetalSchema = z.object({
  id: z.string(),
  total_capacity: RawCapacitySchema,
  used_capacity: RawCapacitySchema,
  topology: RawTopologySchema,
  bm_role: BmRoleSchema,
  max_vm_count: z.number().int().positive(),
  current_vm_count: z.number().int().nonnegative(),
  ip_types: z.array(IpTypeSchema),
});
export type RawBaremetal = z.infer<typeof RawBaremetalSchema>;

const RawVmDemandSchema = z.object({
  cpu_cores: z.number().int().positive(),
  memory_mb: z.number().int().positive(),
  disk_gb: z.number().int().positive(),
  gpu_count: z.number().int().nonnegative().default(0),
});

const RawRequestVmSchema = z.object({
  id: z.string(),
  demand: RawVmDemandSchema,
  node_role: BmRoleSchema,
  assigned_bm: z.string().nullable(),
});

export const RawScheduleRequestSchema = z.object({
  id: z.string(),
  cluster_id: z.string(),
  submitted_at: z.number(),
  status: SolverStatusSchema,
  solver_status: SolverStatusSchema,
  solve_time_seconds: z.number().nonnegative(),
  vms: z.array(RawRequestVmSchema),
  unplaced_count: z.number().int().nonnegative(),
  requested_by: z.string(),
  reason: z.string().nullable(),
});
export type RawScheduleRequest = z.infer<typeof RawScheduleRequestSchema>;
