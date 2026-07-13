import { NextRequest, NextResponse } from "next/server";
import { ApiError, handle, readJson, requireApiProfile } from "@/lib/mobileApi";

type Params = { params: Promise<{ id: string }> };

/** Split one location out of a brand into its own entry. */
export async function POST(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { adapter } = await requireApiProfile();
    const { id } = await params;
    const { restaurantId } = await readJson<{ restaurantId?: string }>(req);
    if (!restaurantId) throw new ApiError(400, "restaurantId is required.");
    const newBrandId = await adapter.splitLocation(id, restaurantId);
    return NextResponse.json({ newBrandId });
  });
}
