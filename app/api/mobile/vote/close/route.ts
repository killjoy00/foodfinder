import { NextRequest, NextResponse } from "next/server";
import { ApiError, handle, readJson, requireApiProfile } from "@/lib/mobileApi";
import { closeVote } from "@/lib/services";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { adapter } = await requireApiProfile();
    const { sessionId } = await readJson<{ sessionId?: string }>(req);
    if (!sessionId) throw new ApiError(400, "sessionId is required.");
    await closeVote(adapter, sessionId);
    const session = await adapter.getVoteSession(sessionId);
    return NextResponse.json({ session });
  });
}
