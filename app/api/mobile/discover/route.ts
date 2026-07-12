import { NextResponse } from "next/server";
import { handle, requireApiAuth } from "@/lib/mobileApi";

export async function GET() {
  return handle(async () => {
    const adapter = await requireApiAuth();
    return NextResponse.json({ discoveries: await adapter.listDiscoveries() });
  });
}
