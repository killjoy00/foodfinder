import { NextRequest, NextResponse } from "next/server";
import { registry } from "@/lib/data";
import { cronGuard } from "@/lib/cron";

// Supabase free-tier databases pause after ~7 days without traffic.
// A tiny query twice a week keeps the project awake.
export async function GET(req: NextRequest) {
  const denied = cronGuard(req);
  if (denied) return denied;
  const households = await registry().listHouseholds();
  return NextResponse.json({ ok: true, groups: households.length });
}
