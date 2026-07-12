import { NextResponse } from "next/server";
import { handle, requireApiAuth } from "@/lib/mobileApi";

/** The latest vote session (open or just closed) with its ballots. */
export async function GET() {
  return handle(async () => {
    const adapter = await requireApiAuth();
    const session = await adapter.getLatestVoteSession();
    const votes = session ? await adapter.listVotes(session.id) : [];
    return NextResponse.json(session ? { session, votes } : { session: null, votes: [] });
  });
}
