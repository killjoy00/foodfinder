import { NextRequest, NextResponse } from "next/server";
import { ApiError, handle, readJson, requireApiProfile } from "@/lib/mobileApi";
import { RecommendationPick, addRecommendationToWishlist } from "@/lib/services";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { adapter } = await requireApiProfile();
    const { place } = await readJson<{ place?: RecommendationPick }>(req);
    if (!place?.name || !place.placeId) throw new ApiError(400, "A place is required.");
    await addRecommendationToWishlist(adapter, place);
    return NextResponse.json({ ok: true });
  });
}
