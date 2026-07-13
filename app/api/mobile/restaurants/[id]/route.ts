import { NextRequest, NextResponse } from "next/server";
import { ApiError, handle, readJson, requireApiAuth, requireApiProfile } from "@/lib/mobileApi";
import { RestaurantInput, ensureCoords, normalizeRestaurantInput } from "@/lib/services";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const adapter = await requireApiAuth();
    const { id } = await params;
    const restaurant = await adapter.getRestaurant(id);
    if (!restaurant) throw new ApiError(404, "No such restaurant.");
    const visits = await adapter.listVisitsForRestaurant(id);
    return NextResponse.json({ restaurant, visits });
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { adapter } = await requireApiProfile();
    const { id } = await params;
    const existing = await adapter.getRestaurant(id);
    if (!existing) throw new ApiError(404, "No such restaurant.");
    const data = await ensureCoords(
      normalizeRestaurantInput(await readJson<RestaurantInput>(req)),
      existing.address ?? null
    );
    if (!data.name) throw new ApiError(400, "A restaurant needs a name.");
    await adapter.updateRestaurant(id, data);
    return NextResponse.json({ restaurant: await adapter.getRestaurant(id) });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { adapter } = await requireApiProfile();
    const { id } = await params;
    await adapter.deleteRestaurant(id);
    return NextResponse.json({ ok: true });
  });
}
