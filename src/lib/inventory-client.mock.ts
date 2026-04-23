import type { InventoryClient } from './inventory-client';
import type {
  BmRole,
  RawBaremetal,
  RawScheduleRequest,
  SolverStatus,
} from './inventory-types';

function makeRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generate() {
  const rng = makeRng(42);
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;
  const int = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

  const AGS = ['ag-us-east-1a', 'ag-us-east-1b', 'ag-us-east-1c'] as const;
  const RACKS = ['rack-01', 'rack-02', 'rack-03', 'rack-04', 'rack-05'] as const;
  const CLUSTERS = [
    'cluster-prod-1',
    'cluster-prod-2',
    'cluster-staging-1',
  ] as const;
  const USERS = [
    'alice@example.com',
    'bob@example.com',
    'carol@example.com',
  ] as const;
  const NODE_ROLES: BmRole[] = ['worker', 'worker', 'worker', 'master', 'infra'];
  const STATUSES: SolverStatus[] = [
    'OPTIMAL',
    'OPTIMAL',
    'OPTIMAL',
    'FEASIBLE',
    'FEASIBLE',
    'INFEASIBLE',
  ];

  const baremetals: RawBaremetal[] = [];
  for (let i = 0; i < 15; i++) {
    baremetals.push({
      id: `bm-${String(i + 1).padStart(3, '0')}`,
      total_capacity: {
        cpu_cores: 32,
        memory_mb: 256 * 1024,
        disk_gb: 2048,
        gpu_count: 0,
      },
      used_capacity: {
        cpu_cores: int(4, 16),
        memory_mb: int(8, 80) * 1024,
        disk_gb: int(50, 800),
        gpu_count: 0,
      },
      topology: {
        site: 'us-east-1',
        phase: 'production',
        datacenter: 'dc-01',
        rack: pick(RACKS),
        unit: int(1, 40),
        rack_height: 42,
        ag: AGS[i % AGS.length]!,
      },
      bm_role: 'worker',
      max_vm_count: 20,
      current_vm_count: int(2, 8),
      ip_types: ['routable'],
    });
  }

  const requests: RawScheduleRequest[] = [];
  const now = Date.now();
  for (let i = 0; i < 20; i++) {
    const status = pick(STATUSES);
    const vmCount = int(2, 12);
    const ageMinutes = int(5, 48 * 60);
    const vms: RawScheduleRequest['vms'] = [];
    for (let v = 0; v < vmCount; v++) {
      const infeasible = status === 'INFEASIBLE' && v % 3 === 0;
      vms.push({
        id: `vm-${i}-${v}`,
        demand: {
          cpu_cores: int(1, 8),
          memory_mb: int(2, 32) * 1024,
          disk_gb: int(20, 200),
          gpu_count: 0,
        },
        node_role: pick(NODE_ROLES),
        assigned_bm: infeasible ? null : pick(baremetals).id,
      });
    }
    const unplaced = vms.filter((v) => v.assigned_bm === null).length;
    requests.push({
      id: `req-${String(i + 1).padStart(4, '0')}`,
      cluster_id: pick(CLUSTERS),
      submitted_at: now - ageMinutes * 60_000,
      status,
      solver_status: status,
      solve_time_seconds: Number((rng() * 8).toFixed(2)),
      vms,
      unplaced_count: unplaced,
      requested_by: pick(USERS),
      reason:
        status === 'INFEASIBLE' ? 'Insufficient capacity in target AG' : null,
    });
  }

  return { baremetals, requests };
}

export function createMockInventoryClient(): InventoryClient {
  return {
    async listScheduleRequests() {
      return generate().requests;
    },
    async listBaremetals() {
      return generate().baremetals;
    },
  };
}
