import { NextRequest, NextResponse } from "next/server";
import { handle, requireApiAuth } from "@/lib/mobileApi";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const adapter = await requireApiAuth();
    const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 50));
    return NextResponse.json({ visits: await adapter.listRecentVisits(limit) });
  });
}
