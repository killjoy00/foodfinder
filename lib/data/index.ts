import { DataAdapter, HouseholdRegistry } from "./adapter";
import { DEMO_HOUSEHOLD_ID, MemoryAdapter, MemoryRegistry } from "./memory";
import { SupabaseAdapter, SupabaseRegistry } from "./supabase";
import { getActiveHouseholdId } from "../household";

/**
 * Demo mode: when Supabase env vars aren't set, the app runs fully against
 * an in-memory store (seeded with a "Demo Family" group) so it can be
 * previewed before any accounts exist.
 */
export function isDemoMode(): boolean {
  return !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

const g = globalThis as unknown as { __ffRegistry?: HouseholdRegistry };

/** Tenant registry (household lookup/create) — not scoped to one group. */
export function registry(): HouseholdRegistry {
  if (!g.__ffRegistry) {
    g.__ffRegistry = isDemoMode()
      ? new MemoryRegistry()
      : new SupabaseRegistry(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return g.__ffRegistry;
}

/** A data adapter scoped to a specific household. */
export function scopedDb(householdId: string): DataAdapter {
  return isDemoMode()
    ? new MemoryAdapter(householdId)
    : new SupabaseAdapter(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, householdId);
}

/**
 * The data adapter for the current request, scoped to the logged-in group.
 * Falls back to the demo group when previewing without a login.
 */
export async function db(): Promise<DataAdapter> {
  const hid = await getActiveHouseholdId();
  return scopedDb(hid ?? (isDemoMode() ? DEMO_HOUSEHOLD_ID : "__none__"));
}

export { DEMO_HOUSEHOLD_ID };
