import type { InventoryClient } from './inventory-client';
import type { RawBaremetal, RawScheduleRequest } from './inventory-types';

// TODO(contract): The real Inventory API is internal-only and its contract is
// not yet finalized. Update the paths, auth model, and any field-name adapters
// once the API owner supplies the spec. Keep the shape returned from this
// client matching inventory-types.ts so sync.ts doesn't have to know or care.

export function createHttpInventoryClient(): InventoryClient {
  const base = process.env.INVENTORY_BASE_URL;
  if (!base) {
    throw new Error(
      'INVENTORY_BASE_URL is not set. Set it, or use INVENTORY_MODE=mock.',
    );
  }
  const authHeader: Record<string, string> = process.env.INVENTORY_API_KEY
    ? { authorization: `Bearer ${process.env.INVENTORY_API_KEY}` }
    : {};

  async function getJson<T>(path: string): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      headers: { accept: 'application/json', ...authHeader },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(
        `Inventory API ${res.status} ${res.statusText} at ${path}`,
      );
    }
    return res.json() as Promise<T>;
  }

  return {
    async listScheduleRequests() {
      // TODO(contract): confirm path + pagination.
      return getJson<RawScheduleRequest[]>('/schedule-requests');
    },
    async listBaremetals() {
      // TODO(contract): confirm path.
      return getJson<RawBaremetal[]>('/baremetals');
    },
  };
}
