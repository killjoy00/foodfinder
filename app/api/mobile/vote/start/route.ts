import { NextRequest, NextResponse } from "next/server";
import { ApiError, handle, readJson, requireApiProfile } from "@/lib/mobileApi";
import { startQuickVote } from "@/lib/services";

/**
 * Start a family vote — either from explicit candidates (the wheel's
 * "vote on these" flow) or as a quick vote sampled from the collection.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const { adapter } = await requireApiProfile();
    const { candidateIds, count } = await readJson<{ candidateIds?: string[]; count?: number }>(
      req
    );
    if (candidateIds && candidateIds.length >= 2) {
      const session = await adapter.createVoteSession(candidateIds.slice(0, 8));
      return NextResponse.json({ session });
    }
    const session = await startQuickVote(adapter, count ?? 0);
    if (!session) throw new ApiError(400, "Not enough restaurants to vote on yet.");
    return NextResponse.json({ session });
  });
}
