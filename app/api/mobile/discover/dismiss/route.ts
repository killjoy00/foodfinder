import { NextRequest, NextResponse } from "next/server";
import { ApiError, handle, readJson, requireApiProfile } from "@/lib/mobileApi";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { adapter } = await requireApiProfile();
    const { placeId } = await readJson<{ placeId?: string }>(req);
    if (!placeId) throw new ApiError(400, "placeId is required.");
    await adapter.dismissDiscovery(placeId);
    return NextResponse.json({ ok: true });
  });
}
