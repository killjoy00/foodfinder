import { Vote } from "./types";

/**
 * Tally a family vote. Rules:
 * - Any candidate vetoed by anyone is out — unless that would eliminate
 *   everyone, in which case vetoes cancel out and are ignored.
 * - Most picks wins; ties break by (seeded) random among the tied.
 */
export function tallyVotes(
  candidateIds: string[],
  votes: Vote[],
  rng: () => number = Math.random
): string | null {
  if (candidateIds.length === 0) return null;

  const vetoed = new Set(votes.map((v) => v.vetoId).filter((id): id is string => !!id));
  let alive = candidateIds.filter((id) => !vetoed.has(id));
  if (alive.length === 0) alive = [...candidateIds];

  const counts = new Map<string, number>(alive.map((id) => [id, 0]));
  for (const vote of votes) {
    if (vote.pickId && counts.has(vote.pickId)) {
      counts.set(vote.pickId, counts.get(vote.pickId)! + 1);
    }
  }

  const max = Math.max(...counts.values());
  const winners = alive.filter((id) => counts.get(id) === max);
  return winners[Math.floor(rng() * winners.length)] ?? null;
}
