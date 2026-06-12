import { NextRequest, NextResponse } from "next/server";
import { runDiscoverySweep } from "@/lib/sweep";

// Vercel Cron hits this weekly (see vercel.json). When CRON_SECRET is set,
// Vercel sends it as a bearer token automatically.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runDiscoverySweep();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
