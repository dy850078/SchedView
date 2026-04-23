import type { RawBaremetal, RawScheduleRequest } from './inventory-types';
import { createMockInventoryClient } from './inventory-client.mock';
import { createHttpInventoryClient } from './inventory-client.http';

export interface InventoryClient {
  listScheduleRequests(opts?: { since?: number }): Promise<RawScheduleRequest[]>;
  listBaremetals(): Promise<RawBaremetal[]>;
}

export function createInventoryClient(): InventoryClient {
  const mode = process.env.INVENTORY_MODE ?? 'mock';
  if (mode === 'http') return createHttpInventoryClient();
  return createMockInventoryClient();
}
