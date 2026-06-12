import { RestaurantFull, daysSince } from "./types";

export const DEFAULT_VOTE_SIZE = 4;
export const VOTE_SIZE_CHOICES = [2, 3, 4, 5, 6];

export type PickerFilters = {
  cuisines: string[]; // empty = any
  maxPrice: number; // 1-4
  tags: string[]; // restaurant must have all selected tags
  mode: "dine_in" | "takeout";
  eaterIds: string[]; // profiles eating tonight; empty = everyone unknown
  wishlistPercent: number; // 0-100 chance of picking from the wishlist pool
  minScore: number; // 0 = any; else someone (eating) must rate it at least this
  excludeIds: string[]; // already rerolled / vetoed this session
};

export const DEFAULT_FILTERS: PickerFilters = {
  cuisines: [],
  maxPrice: 4,
  tags: [],
  mode: "dine_in",
  eaterIds: [],
  wishlistPercent: 20,
  minScore: 5,
  excludeIds: [],
};

export type WeightedCandidate = {
  restaurant: RestaurantFull;
  weight: number;
  reasons: string[];
};

/** Average rating across the selected eaters; unrated counts as a neutral 5. */
export function eaterScore(r: RestaurantFull, eaterIds: string[]): number {
  const ids = eaterIds.length > 0 ? eaterIds : Object.keys(r.ratings);
  if (ids.length === 0) return 5;
  const scores = ids.map((id) => r.ratings[id] ?? 5);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Cuisines that appeared 2+ times in the last 3 visits — "third Mexican
 * night in a row" gets penalized.
 */
export function streakCuisines(recentVisitCuisines: string[][]): Set<string> {
  const counts = new Map<string, number>();
  for (const cuisines of recentVisitCuisines.slice(0, 3)) {
    for (const c of new Set(cuisines.map((x) => x.toLowerCase()))) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return new Set([...counts.entries()].filter(([, n]) => n >= 2).map(([c]) => c));
}

/**
 * Best rating among the selected eaters (all raters when nobody is
 * selected); null when none of them have rated it yet.
 */
export function maxRelevantScore(r: RestaurantFull, eaterIds: string[]): number | null {
  const ids = eaterIds.length > 0 ? eaterIds : Object.keys(r.ratings);
  const scores = ids
    .map((id) => r.ratings[id])
    .filter((s): s is number => s !== undefined);
  return scores.length > 0 ? Math.max(...scores) : null;
}

export function passesFilters(r: RestaurantFull, f: PickerFilters): boolean {
  if (f.excludeIds.includes(r.id)) return false;
  if (r.price > f.maxPrice) return false;
  if (f.minScore > 0) {
    // the quality bar: someone eating tonight has to actually like it —
    // unrated places stay eligible so the wishlist isn't locked out
    const best = maxRelevantScore(r, f.eaterIds);
    if (best !== null && best < f.minScore) return false;
  }
  if (f.mode === "takeout" && r.tags.length > 0 && !r.tags.includes("takeout")) {
    // only enforce when the restaurant has been tagged at all
    return false;
  }
  if (
    f.cuisines.length > 0 &&
    !r.cuisines.some((c) => f.cuisines.map((x) => x.toLowerCase()).includes(c.toLowerCase()))
  ) {
    return false;
  }
  for (const tag of f.tags) {
    if (!r.tags.includes(tag)) return false;
  }
  return true;
}

export function weighCandidate(
  r: RestaurantFull,
  f: PickerFilters,
  streaks: Set<string>,
  now: Date = new Date()
): WeightedCandidate {
  const reasons: string[] = [];

  // Rating: neutral 5 → 1.0, a family 10 → 4.0, a 2 → ~0.16
  const score = eaterScore(r, f.eaterIds);
  const ratingWeight = (score * score) / 25;
  if (score >= 8) reasons.push("family favorite");

  // Recency: just visited → 0.5, never or long ago → up to 2.5
  const days = daysSince(r.lastVisitAt, now);
  let recencyBoost: number;
  if (days === null) {
    recencyBoost = r.status === "wishlist" ? 1.5 : 1.25;
    if (r.status === "wishlist") reasons.push("on the wishlist");
  } else {
    recencyBoost = 0.5 + Math.min(days, 120) / 60;
    if (days >= 45) reasons.push(`haven't been in ${days} days`);
  }

  // Streak breaking
  let streakPenalty = 1;
  if (r.cuisines.some((c) => streaks.has(c.toLowerCase()))) {
    streakPenalty = 0.25;
    reasons.push("you've had this cuisine a lot lately");
  }

  return { restaurant: r, weight: ratingWeight * recencyBoost * streakPenalty, reasons };
}

export function buildCandidates(
  restaurants: RestaurantFull[],
  filters: PickerFilters,
  recentVisitCuisines: string[][],
  now: Date = new Date()
): { regulars: WeightedCandidate[]; wishlist: WeightedCandidate[] } {
  const streaks = streakCuisines(recentVisitCuisines);
  const eligible = restaurants.filter((r) => passesFilters(r, filters));
  const weigh = (r: RestaurantFull) => weighCandidate(r, filters, streaks, now);
  return {
    regulars: eligible.filter((r) => r.status === "active").map(weigh),
    wishlist: eligible.filter((r) => r.status === "wishlist").map(weigh),
  };
}

export function pickWeighted<T extends { weight: number }>(
  items: T[],
  rng: () => number = Math.random
): T | null {
  const total = items.reduce((a, b) => a + b.weight, 0);
  if (items.length === 0 || total <= 0) return null;
  let roll = rng() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

/**
 * Pick tonight's restaurant. Rolls the wishlist die first (per the
 * "X% something new" slider), then does a weighted pick within the pool.
 */
export function pickTonight(
  restaurants: RestaurantFull[],
  filters: PickerFilters,
  recentVisitCuisines: string[][],
  rng: () => number = Math.random,
  now: Date = new Date()
): WeightedCandidate | null {
  const { regulars, wishlist } = buildCandidates(restaurants, filters, recentVisitCuisines, now);
  const useWishlist =
    wishlist.length > 0 && (regulars.length === 0 || rng() * 100 < filters.wishlistPercent);
  return pickWeighted(useWishlist ? wishlist : regulars, rng) ?? pickWeighted(regulars, rng);
}

/** Weighted sample of up to `count` distinct candidates (for family votes). */
export function sampleCandidates(
  pool: WeightedCandidate[],
  count: number,
  rng: () => number = Math.random
): WeightedCandidate[] {
  const remaining = pool.filter((c) => c.weight > 0);
  const sampled: WeightedCandidate[] = [];
  while (sampled.length < count && remaining.length > 0) {
    const pick = pickWeighted(remaining, rng);
    if (!pick) break;
    sampled.push(pick);
    remaining.splice(remaining.indexOf(pick), 1);
  }
  return sampled;
}

/**
 * Segments for the spin wheel: the (pre-chosen) winner plus up to
 * `max - 1` other top candidates, shuffled so the winner isn't obvious.
 */
export function wheelSegments(
  winner: WeightedCandidate,
  all: WeightedCandidate[],
  max = 8,
  rng: () => number = Math.random
): WeightedCandidate[] {
  const others = all
    .filter((c) => c.restaurant.id !== winner.restaurant.id)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, max - 1);
  const segments = [winner, ...others];
  for (let i = segments.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [segments[i], segments[j]] = [segments[j], segments[i]];
  }
  return segments;
}
