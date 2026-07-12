import { NextResponse } from "next/server";
import { handle, requireApiProfile } from "@/lib/mobileApi";
import { runDiscoverySweep } from "@/lib/sweep";

/** Run the new-restaurant sweep on demand (same as the weekly cron). */
export async function POST() {
  return handle(async () => {
    const { adapter } = await requireApiProfile();
    const result = await runDiscoverySweep(adapter);
    return NextResponse.json(result);
  });
}
