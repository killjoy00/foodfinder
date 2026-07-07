import { Nomination, Vote } from "./types";

/**
 * Tally a family vote. Rules:
 * - Any candidate vetoed by anyone is out — unless that would eliminate
 *   everyone, in which case vetoes cancel out and are ignored.
 * - Most picks wins, where each voter's pick is worth `weightOf(profile)`
 *   (normally 1, but 2 for someone who banked a "defer" last round).
 * - Deferred votes (no pick) don't count toward any candidate.
 * - Ties break by (seeded) random among the tied.
 */
export function tallyVotes(
  candidateIds: string[],
  votes: Vote[],
  rng: () => number = Math.random,
  weightOf: (profileId: string) => number = () => 1
): string | null {
  if (candidateIds.length === 0) return null;

  const vetoed = new Set(votes.map((v) => v.vetoId).filter((id): id is string => !!id));
  let alive = candidateIds.filter((id) => !vetoed.has(id));
  if (alive.length === 0) alive = [...candidateIds];

  const counts = new Map<string, number>(alive.map((id) => [id, 0]));
  for (const vote of votes) {
    if (vote.deferred) continue;
    if (vote.pickId && counts.has(vote.pickId)) {
      counts.set(vote.pickId, counts.get(vote.pickId)! + Math.max(1, weightOf(vote.profileId)));
    }
  }

  const max = Math.max(...counts.values());
  const winners = alive.filter((id) => counts.get(id) === max);
  return winners[Math.floor(rng() * winners.length)] ?? null;
}

export type NominationCandidate = {
  brandId: string;
  nominatorIds: string[]; // in nomination order, deduped
};

/**
 * Collapse raw nominations into distinct ballot candidates, in first-nominated
 * order. Each person contributes at most `capPerProfile` nominations (extras
 * beyond the cap are dropped, oldest kept); duplicate nominations of the same
 * brand merge, remembering everyone who proposed it.
 */
export function nominationCandidates(
  nominations: Nomination[],
  capPerProfile = Infinity
): NominationCandidate[] {
  const sorted = [...nominations].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const usedBy = new Map<string, number>();
  const out = new Map<string, NominationCandidate>();
  for (const n of sorted) {
    const used = usedBy.get(n.profileId) ?? 0;
    if (used >= capPerProfile) continue;
    usedBy.set(n.profileId, used + 1);
    const entry = out.get(n.brandId);
    if (!entry) out.set(n.brandId, { brandId: n.brandId, nominatorIds: [n.profileId] });
    else if (!entry.nominatorIds.includes(n.profileId)) entry.nominatorIds.push(n.profileId);
  }
  return [...out.values()];
}
