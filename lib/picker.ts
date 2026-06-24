import { RestaurantFull, daysSince, isSpecialCuisine } from "./types";
import { LatLng, distanceMiles } from "./distance";

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
  recencyStrength: number; // 0-100: how hard to avoid recently visited places & cuisines
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
  recencyStrength: 60,
  excludeIds: [],
};

export type WeightedCandidate = {
  restaurant: RestaurantFull;
  weight: number;
  reasons: string[];
};

/** Lowercase cuisine -> days since the group last ate it. */
export type CuisineRecency = Record<string, number>;

/** Average rating across the selected eaters; unrated counts as a neutral 5. */
export function eaterScore(r: RestaurantFull, eaterIds: string[]): number {
  const ids = eaterIds.length > 0 ? eaterIds : Object.keys(r.ratings);
  if (ids.length === 0) return 5;
  const scores = ids.map((id) => r.ratings[id] ?? 5);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * The ratings that matter for tonight: just the selected eaters' scores, or
 * every rater's when nobody's been singled out. Members who haven't rated the
 * place are skipped.
 */
export function relevantScores(r: RestaurantFull, eaterIds: string[]): number[] {
  const ids = eaterIds.length > 0 ? eaterIds : Object.keys(r.ratings);
  return ids.map((id) => r.ratings[id]).filter((s): s is number => s !== undefined);
}

/**
 * How much the relevant eaters agree, as a 0.5–1.0 weight multiplier: a tight
 * spread keeps the full weight, a wide split (8+ points) halves it. Fewer than
 * two ratings can't disagree, so they keep full weight.
 */
function eaterAgreement(r: RestaurantFull, eaterIds: string[]): number {
  const scores = relevantScores(r, eaterIds);
  if (scores.length < 2) return 1;
  const spread = Math.max(...scores) - Math.min(...scores);
  return 1 - (0.5 * Math.min(spread, 8)) / 8;
}

/** The special cuisines this restaurant carries (e.g. dessert, coffee). */
function specialCuisinesOf(r: RestaurantFull): string[] {
  return r.cuisines.map((c) => c.trim().toLowerCase()).filter(isSpecialCuisine);
}

/** Build a cuisine -> days-since-last-eaten map from recent visits. */
export function buildCuisineRecency(
  visits: { restaurantId: string; date: string }[],
  cuisinesByRestaurant: Map<string, string[]>,
  now: Date = new Date()
): CuisineRecency {
  const out: CuisineRecency = {};
  for (const v of visits) {
    const days = daysSince(v.date, now);
    if (days === null) continue;
    for (const c of cuisinesByRestaurant.get(v.restaurantId) ?? []) {
      const key = c.trim().toLowerCase();
      if (!key) continue;
      if (out[key] === undefined || days < out[key]) out[key] = days;
    }
  }
  return out;
}

export function passesFilters(r: RestaurantFull, f: PickerFilters): boolean {
  if (f.excludeIds.includes(r.id)) return false;
  if (r.price > f.maxPrice) return false;
  // special places (dessert/coffee/tea) only appear when their cuisine is chosen
  const rSpecials = specialCuisinesOf(r);
  if (rSpecials.length > 0) {
    const selected = new Set(f.cuisines.map((c) => c.trim().toLowerCase()));
    if (!rSpecials.some((s) => selected.has(s))) return false;
  }
  if (f.minScore > 0) {
    // the quality bar, judged only by who's eating: every selected eater who's
    // rated it has to clear the bar (so the wheel can't land on a place one of
    // them dislikes — and so a non-eater's rating never sneaks a place in).
    const scores = relevantScores(r, f.eaterIds);
    if (scores.length > 0) {
      if (Math.min(...scores) < f.minScore) return false;
    } else if (f.eaterIds.length > 0 && Object.keys(r.ratings).length > 0) {
      // tonight's eaters haven't rated it but other members have — it's not a
      // fresh wishlist find, so don't surface it under their bar. (A place
      // nobody has rated yet stays eligible.)
      return false;
    }
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
  cuisineRecency: CuisineRecency,
  now: Date = new Date()
): WeightedCandidate {
  const reasons: string[] = [];

  // Rating: neutral 5 → 1.0, a family 10 → 4.0, a 2 → ~0.16
  const score = eaterScore(r, f.eaterIds);
  const ratingWeight = (score * score) / 25;
  if (score >= 8) reasons.push("family favorite");

  // Consensus: lean the wheel toward places the table agrees on, away from
  // the ones half of them can't stand even if the average looks fine.
  const agreement = eaterAgreement(r, f.eaterIds);
  if (agreement < 0.8) reasons.push("the table's split on this");

  const strength = Math.max(0, Math.min(1, f.recencyStrength / 100));

  // Place recency: just visited → heavily down-weighted, recovering over ~45 days.
  const days = daysSince(r.lastVisitAt, now);
  let placeFactor: number;
  if (days === null) {
    placeFactor = r.status === "wishlist" ? 1.4 : 1.15;
    if (r.status === "wishlist") reasons.push("on the wishlist");
  } else {
    placeFactor = 0.15 + (0.85 * Math.min(days, 45)) / 45;
    if (days >= 45) reasons.push(`haven't been in ${days} days`);
  }
  const placeMult = 1 + strength * (placeFactor - 1);

  // Cuisine recency: avoid cuisines eaten recently — but only when the user
  // isn't already steering by cuisine (picking BBQ removes BBQ's penalty).
  let cuisineMult = 1;
  if (f.cuisines.length === 0) {
    let worst = 1;
    let worstCuisine: string | null = null;
    for (const c of r.cuisines) {
      const cdays = cuisineRecency[c.trim().toLowerCase()];
      if (cdays === undefined) continue;
      const factor = 0.1 + (0.9 * Math.min(cdays, 14)) / 14; // 0.1 just-eaten → 1.0 at 14 days
      if (factor < worst) {
        worst = factor;
        worstCuisine = c;
      }
    }
    cuisineMult = 1 + strength * (worst - 1);
    if (worstCuisine && cuisineMult < 0.7) reasons.push(`had ${worstCuisine} recently`);
  }

  return { restaurant: r, weight: ratingWeight * agreement * placeMult * cuisineMult, reasons };
}

/** Normalized key for grouping chain locations (e.g. every "Chick-fil-A"). */
export function chainKey(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
}

/**
 * How many of the given restaurants share each brand name, keyed by chainKey.
 * Lets the UI flag when a family is tracking several locations of one place
 * (the same grouping the wheel uses when it collapses chains).
 */
export function locationCounts(restaurants: RestaurantFull[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of restaurants) {
    const k = chainKey(r.name);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

/**
 * Collapse multi-location chains into one candidate so the wheel shows a
 * chain once. The representative is the nearest location (when we know where
 * "here" is), ratings are averaged across locations, and recency/visits are
 * pooled. Single-location restaurants pass through untouched.
 */
export function collapseChains(
  restaurants: RestaurantFull[],
  origin?: LatLng | null
): RestaurantFull[] {
  const groups = new Map<string, RestaurantFull[]>();
  for (const r of restaurants) {
    const arr = groups.get(chainKey(r.name));
    if (arr) arr.push(r);
    else groups.set(chainKey(r.name), [r]);
  }

  const out: RestaurantFull[] = [];
  for (const locs of groups.values()) {
    if (locs.length === 1) {
      out.push(locs[0]);
      continue;
    }
    let rep = locs[0];
    if (origin && origin.lat !== null && origin.lng !== null) {
      let best = Infinity;
      for (const l of locs) {
        const d = distanceMiles(origin, l);
        if (d !== null && d < best) {
          best = d;
          rep = l;
        }
      }
    } else {
      rep = locs.reduce((a, b) => ((b.lastVisitAt ?? "") > (a.lastVisitAt ?? "") ? b : a), locs[0]);
    }

    const sums = new Map<string, { sum: number; n: number }>();
    for (const l of locs) {
      for (const [pid, score] of Object.entries(l.ratings)) {
        const e = sums.get(pid) ?? { sum: 0, n: 0 };
        e.sum += score;
        e.n += 1;
        sums.set(pid, e);
      }
    }
    const ratings: Record<string, number> = {};
    for (const [pid, { sum, n }] of sums) ratings[pid] = Math.round(sum / n);

    const lastVisitAt =
      locs.map((l) => l.lastVisitAt).filter((d): d is string => !!d).sort().pop() ?? null;

    out.push({
      ...rep,
      ratings,
      lastVisitAt,
      visitCount: locs.reduce((a, l) => a + l.visitCount, 0),
      status: locs.some((l) => l.status === "active") ? "active" : "wishlist",
      cuisines: [...new Set(locs.flatMap((l) => l.cuisines))],
      chainCount: locs.length,
    });
  }
  return out;
}

export function buildCandidates(
  restaurants: RestaurantFull[],
  filters: PickerFilters,
  cuisineRecency: CuisineRecency,
  now: Date = new Date()
): { regulars: WeightedCandidate[]; wishlist: WeightedCandidate[] } {
  const eligible = restaurants.filter((r) => passesFilters(r, filters));
  const weigh = (r: RestaurantFull) => weighCandidate(r, filters, cuisineRecency, now);
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
  cuisineRecency: CuisineRecency,
  rng: () => number = Math.random,
  now: Date = new Date()
): WeightedCandidate | null {
  const { regulars, wishlist } = buildCandidates(restaurants, filters, cuisineRecency, now);
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
