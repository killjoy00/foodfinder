import { NextRequest, NextResponse } from "next/server";
import { ApiError, handle, readJson, requireApiProfile } from "@/lib/mobileApi";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { adapter } = await requireApiProfile();
    const { sessionId } = await readJson<{ sessionId?: string }>(req);
    if (!sessionId) throw new ApiError(400, "sessionId is required.");
    await adapter.closeVoteSession(sessionId, null);
    return NextResponse.json({ ok: true });
  });
}
