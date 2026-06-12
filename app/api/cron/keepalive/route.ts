import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/data";

// Supabase free-tier databases pause after ~7 days without traffic.
// A tiny query twice a week keeps the project awake.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const profiles = await db().listProfiles();
  return NextResponse.json({ ok: true, profiles: profiles.length });
}
