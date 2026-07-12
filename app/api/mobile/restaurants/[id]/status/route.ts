import { NextRequest, NextResponse } from "next/server";
import { handle, readJson, requireApiProfile } from "@/lib/mobileApi";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { adapter } = await requireApiProfile();
    const { id } = await params;
    const { status } = await readJson<{ status?: string }>(req);
    await adapter.updateRestaurant(id, {
      status: status === "wishlist" ? "wishlist" : "active",
    });
    return NextResponse.json({ ok: true });
  });
}
