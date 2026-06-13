import { NextRequest, NextResponse } from "next/server";
import { registry } from "@/lib/data";

// Supabase free-tier databases pause after ~7 days without traffic.
// A tiny query twice a week keeps the project awake.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const households = await registry().listHouseholds();
  return NextResponse.json({ ok: true, groups: households.length });
}
