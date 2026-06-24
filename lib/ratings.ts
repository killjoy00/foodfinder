/**
 * Family rating aggregation. A plain average has two blind spots: a single
 * enthusiastic rating can outrank a place the whole family agrees on, and a
 * divisive 10/2 split looks identical to a calm 6/6. `ratingStats` folds both
 * coverage (how many rated) and agreement (how tight the spread is) into one
 * 0–10 "consensus" number you can sort and weight by.
 */

export type RatingStats = {
  count: number; // how many family members have rated it
  mean: number; // plain average (0 when nobody has rated)
  spread: number; // highest minus lowest rating (0 when fewer than two)
  consensus: number; // 0–10: coverage-shrunk mean minus a disagreement penalty
  divisive: boolean; // notable disagreement among raters
};

const PRIOR = 5; // neutral score thin coverage is pulled toward
const PSEUDO = 1; // strength of that pull (one phantom neutral rating)
const SPREAD_PENALTY = 0.5; // how hard disagreement docks the score

export function ratingStats(ratings: Record<string, number>): RatingStats {
  const scores = Object.values(ratings);
  const count = scores.length;
  if (count === 0) return { count: 0, mean: 0, spread: 0, consensus: 0, divisive: false };

  const sum = scores.reduce((a, b) => a + b, 0);
  const mean = sum / count;
  const variance = scores.reduce((a, s) => a + (s - mean) ** 2, 0) / count;
  const std = Math.sqrt(variance);
  const spread = Math.max(...scores) - Math.min(...scores);

  // Bayesian shrink toward neutral so a lone high rating doesn't beat a place
  // the whole family agrees on; the more people rate it, the less it shrinks.
  const adjusted = (sum + PSEUDO * PRIOR) / (count + PSEUDO);
  const consensus = Math.max(0, Math.min(10, adjusted - SPREAD_PENALTY * std));

  return { count, mean, spread, consensus, divisive: count >= 2 && spread >= 4 };
}
