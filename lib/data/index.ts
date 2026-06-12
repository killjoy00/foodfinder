import { DataAdapter } from "./adapter";
import { MemoryAdapter } from "./memory";
import { SupabaseAdapter } from "./supabase";

/**
 * Demo mode: when Supabase env vars aren't set, the app runs fully
 * against an in-memory store (seeded with sample data, resets on restart)
 * so it can be previewed before any accounts exist.
 */
export function isDemoMode(): boolean {
  return !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

const globalDb = globalThis as unknown as { __ffDb?: DataAdapter };

export function db(): DataAdapter {
  if (!globalDb.__ffDb) {
    globalDb.__ffDb = isDemoMode()
      ? new MemoryAdapter()
      : new SupabaseAdapter(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return globalDb.__ffDb;
}
