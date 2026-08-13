import { NextRequest, NextResponse } from "next/server";
import { registry, scopedDb } from "@/lib/data";
import { runDiscoverySweep } from "@/lib/sweep";
import { cronGuard } from "@/lib/cron";

// Vercel Cron hits this weekly (see vercel.json). When CRON_SECRET is set,
// Vercel sends it as a bearer token automatically. Sweeps every group that
// has set a home location.
export async function GET(req: NextRequest) {
  const denied = cronGuard(req);
  if (denied) return denied;
  const households = await registry().listHouseholds();
  const results: Record<string, unknown> = {};
  for (const h of households) {
    results[h.name] = await runDiscoverySweep(scopedDb(h.id));
  }
  return NextResponse.json({ ok: true, groups: households.length, results });
}
