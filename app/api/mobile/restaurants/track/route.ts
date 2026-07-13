import { NextRequest, NextResponse } from "next/server";
import { ApiError, handle, readJson, requireApiProfile } from "@/lib/mobileApi";
import { trackRestaurantWithGeocode } from "@/lib/services";

/** Track a shared-catalog location under this group. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const { adapter } = await requireApiProfile();
    const { restaurantId, status } = await readJson<{ restaurantId?: string; status?: string }>(
      req
    );
    if (!restaurantId) throw new ApiError(400, "restaurantId is required.");
    await trackRestaurantWithGeocode(
      adapter,
      restaurantId,
      status === "wishlist" ? "wishlist" : "active"
    );
    return NextResponse.json({ ok: true });
  });
}
