import { NextRequest, NextResponse } from "next/server";
import { ApiError, handle, readJson, requireApiProfile } from "@/lib/mobileApi";
import { castVote } from "@/lib/services";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { adapter, profile } = await requireApiProfile();
    const body = await readJson<{
      sessionId?: string;
      pickId?: string | null;
      vetoId?: string | null;
      deferred?: boolean;
    }>(req);
    if (!body.sessionId) throw new ApiError(400, "sessionId is required.");
    await castVote(
      adapter,
      profile.id,
      body.sessionId,
      body.pickId ?? null,
      body.vetoId ?? null,
      body.deferred ?? false
    );
    const votes = await adapter.listVotes(body.sessionId);
    return NextResponse.json({ votes });
  });
}
