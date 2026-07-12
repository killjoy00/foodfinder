import { NextRequest, NextResponse } from "next/server";
import { handle, readJson, requireApiAuth, requireApiProfile } from "@/lib/mobileApi";
import { logVisit } from "@/lib/services";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const adapter = await requireApiAuth();
    const { id } = await params;
    return NextResponse.json({ visits: await adapter.listVisitsForRestaurant(id) });
  });
}

/** "We went! 🎉" */
export async function POST(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { adapter } = await requireApiProfile();
    const { id } = await params;
    const { mode, note } = await readJson<{ mode?: string; note?: string }>(req);
    await logVisit(adapter, id, mode === "takeout" ? "takeout" : "dine_in", note);
    return NextResponse.json({ restaurant: await adapter.getRestaurant(id) });
  });
}
