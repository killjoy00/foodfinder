import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/data";
import { NominationPanel } from "@/components/NominationPanel";
import { QuickVoteStart } from "@/components/QuickVoteStart";
import { VotePanel, VoteWinnerView } from "@/components/VotePanel";

export const dynamic = "force-dynamic";

export default async function VotePage() {
  const profile = await requireProfile();
  const adapter = await db();
  const session = await adapter.getOpenVoteSession();

  if (!session) {
    // a nomination round in progress takes over the tab
    const nominating = await adapter.getNominatingSession();
    if (nominating) {
      const [nominations, profiles, restaurants] = await Promise.all([
        adapter.listNominations(nominating.id),
        adapter.listProfiles(),
        adapter.listRestaurants(),
      ]);
      return (
        <NominationPanel
          session={nominating}
          nominations={nominations}
          profiles={profiles}
          restaurants={restaurants}
          activeProfile={profile}
        />
      );
    }

    // a vote that just closed shows its winner for a couple of hours
    const latest = await adapter.getLatestVoteSession();
    if (
      latest?.status === "closed" &&
      latest.winnerId &&
      Date.now() - new Date(latest.closedAt ?? latest.createdAt).getTime() < 2 * 60 * 60 * 1000
    ) {
      const winner = await adapter.getRestaurant(latest.winnerId);
      if (winner) {
        const restaurants = await adapter.listRestaurants();
        return (
          <div className="flex flex-col gap-6 pt-4">
            <VoteWinnerView winner={winner} />
            <details className="mx-auto w-full max-w-sm text-center">
              <summary className="cursor-pointer text-sm text-muted">Start another vote?</summary>
              <div className="mt-3 flex justify-center">
                <QuickVoteStart available={restaurants.length} />
              </div>
            </details>
          </div>
        );
      }
    }
    const restaurants = await adapter.listRestaurants();
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

  const [votes, profiles, restaurants, nominations] = await Promise.all([
    adapter.listVotes(session.id),
    adapter.listProfiles(),
    adapter.listRestaurants(),
    adapter.listNominations(session.id),
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
      nominations={nominations}
    />
  );
}
