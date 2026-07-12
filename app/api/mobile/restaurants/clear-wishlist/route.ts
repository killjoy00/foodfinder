import { NextResponse } from "next/server";
import { handle, requireApiProfile } from "@/lib/mobileApi";

export async function POST() {
  return handle(async () => {
    const { adapter } = await requireApiProfile();
    const removed = await adapter.clearWishlist();
    return NextResponse.json({ removed });
  });
}
