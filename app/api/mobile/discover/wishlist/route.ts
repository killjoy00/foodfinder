import { NextRequest, NextResponse } from "next/server";
import { ApiError, handle, readJson, requireApiProfile } from "@/lib/mobileApi";
import { addDiscoveryToWishlist } from "@/lib/services";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { adapter } = await requireApiProfile();
    const { placeId } = await readJson<{ placeId?: string }>(req);
    if (!placeId) throw new ApiError(400, "placeId is required.");
    const ok = await addDiscoveryToWishlist(adapter, placeId);
    if (!ok) throw new ApiError(404, "That discovery is gone.");
    return NextResponse.json({ ok: true });
  });
}
