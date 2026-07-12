import { NextRequest, NextResponse } from "next/server";
import { ApiError, handle, readJson, requireApiProfile } from "@/lib/mobileApi";

/** Merge brand `loserId` into `survivorId` (duplicate cleanup). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const { adapter } = await requireApiProfile();
    const { survivorId, loserId } = await readJson<{ survivorId?: string; loserId?: string }>(req);
    if (!survivorId || !loserId || survivorId === loserId) {
      throw new ApiError(400, "survivorId and loserId must be two different brands.");
    }
    await adapter.mergeRestaurants(survivorId, loserId);
    return NextResponse.json({ ok: true });
  });
}
