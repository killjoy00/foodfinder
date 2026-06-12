import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/data";
import { QuickVoteStart } from "@/components/QuickVoteStart";
import { VotePanel, VoteWinnerView } from "@/components/VotePanel";

export const dynamic = "force-dynamic";

export default async function VotePage() {
  const profile = await requireProfile();
  const session = await db().getOpenVoteSession();

  if (!session) {
    // a vote that just closed shows its winner for a couple of hours
    const latest = await db().getLatestVoteSession();
    if (
      latest?.status === "closed" &&
      latest.winnerId &&
      Date.now() - new Date(latest.createdAt).getTime() < 2 * 60 * 60 * 1000
    ) {
      const winner = await db().getRestaurant(latest.winnerId);
      if (winner) {
        return (
          <div className="pt-4">
            <VoteWinnerView winner={winner} />
          </div>
        );
      }
    }
    const restaurants = await db().listRestaurants();
    return (
      <div className="flex flex-col items-center gap-4 pt-10 text-center">
        <span className="text-5xl">🗳️</span>
        <h1 className="text-2xl font-bold">No vote running</h1>
        <p className="max-w-sm text-muted">
          Put some options up for a family decision. Everyone picks a favorite — and everyone gets
          one veto.
        </p>
        <QuickVoteStart available={restaurants.length} />
        <Link href="/" className="text-sm text-accent underline">
          or spin the wheel on Tonight first →
        </Link>
      </div>
    );
  }

  const [votes, profiles, restaurants] = await Promise.all([
    db().listVotes(session.id),
    db().listProfiles(),
    db().listRestaurants(),
  ]);
  const candidates = session.candidateIds
    .map((id) => restaurants.find((r) => r.id === id))
    .filter((r) => r !== undefined);

  return (
    <VotePanel
      session={session}
      votes={votes}
      profiles={profiles}
      candidates={candidates}
      activeProfile={profile}
    />
  );
}
