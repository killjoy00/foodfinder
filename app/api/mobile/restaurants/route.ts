import { NextRequest, NextResponse } from "next/server";
import { ApiError, handle, readJson, requireApiAuth, requireApiProfile } from "@/lib/mobileApi";
import { RestaurantInput, ensureCoords, normalizeRestaurantInput } from "@/lib/services";

export async function GET() {
  return handle(async () => {
    const adapter = await requireApiAuth();
    return NextResponse.json({ restaurants: await adapter.listRestaurants() });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { adapter } = await requireApiProfile();
    const data = await ensureCoords(normalizeRestaurantInput(await readJson<RestaurantInput>(req)));
    if (!data.name) throw new ApiError(400, "A restaurant needs a name.");
    const restaurant = await adapter.createRestaurant(data);
    return NextResponse.json({ restaurant });
  });
}
