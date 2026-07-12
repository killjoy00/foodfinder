import { NextResponse } from "next/server";
import { getActiveHousehold } from "@/lib/auth";
import { isDemoMode } from "@/lib/data";
import { handle, requireApiAuth } from "@/lib/mobileApi";

/** Everything the app needs on launch, in one round trip. */
export async function GET() {
  return handle(async () => {
    const adapter = await requireApiAuth();
    const [household, profiles, restaurants, recentVisits, settings, voteSession] =
      await Promise.all([
        getActiveHousehold(),
        adapter.listProfiles(),
        adapter.listRestaurants(),
        adapter.listRecentVisits(50),
        adapter.getSettings(),
        adapter.getLatestVoteSession(),
      ]);
    const votes = voteSession ? await adapter.listVotes(voteSession.id) : [];
    return NextResponse.json({
      household,
      profiles,
      restaurants,
      recentVisits,
      settings,
      vote: voteSession ? { session: voteSession, votes } : null,
      demo: isDemoMode(),
    });
  });
}
