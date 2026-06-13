import { Profile, RestaurantFull, Visit, daysSince } from "./types";

export type Insights = {
  totalPlaces: number;
  totalActive: number;
  totalWishlist: number;
  totalVisits: number;
  topCuisines: { cuisine: string; count: number }[]; // by # of places
  visitedCuisines: { cuisine: string; visits: number }[]; // by # of visits
  priceSpread: { price: number; count: number }[]; // tier 1-4
  mostVisited: { restaurant: RestaurantFull; visits: number }[];
  topRated: { restaurant: RestaurantFull; avg: number }[];
  overdueFavorites: { restaurant: RestaurantFull; avg: number; days: number }[];
  perProfile: { profile: Profile; rated: number; avg: number }[];
  agreement: { a: Profile; b: Profile; sharedRatings: number; closeness: number } | null;
  takeoutShare: number; // fraction of visits that were takeout (0-1)
};

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

/**
 * Roll up everything we've recorded into a "family food story". Pure so it
 * can be unit-tested; the page just renders the result.
 */
export function computeInsights(
  restaurants: RestaurantFull[],
  visits: Visit[],
  profiles: Profile[],
  now: Date = new Date()
): Insights {
  const active = restaurants.filter((r) => r.status === "active");
  const wishlist = restaurants.filter((r) => r.status === "wishlist");
  const byId = new Map(restaurants.map((r) => [r.id, r]));

  // cuisines by number of places
  const cuisinePlaceCounts = new Map<string, number>();
  for (const r of restaurants) {
    for (const c of new Set(r.cuisines.map((x) => x.trim()).filter(Boolean))) {
      cuisinePlaceCounts.set(c, (cuisinePlaceCounts.get(c) ?? 0) + 1);
    }
  }
  const topCuisines = [...cuisinePlaceCounts.entries()]
    .map(([cuisine, count]) => ({ cuisine, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // cuisines by number of visits
  const cuisineVisitCounts = new Map<string, number>();
  for (const v of visits) {
    const r = byId.get(v.restaurantId);
    if (!r) continue;
    for (const c of new Set(r.cuisines.map((x) => x.trim()).filter(Boolean))) {
      cuisineVisitCounts.set(c, (cuisineVisitCounts.get(c) ?? 0) + 1);
    }
  }
  const visitedCuisines = [...cuisineVisitCounts.entries()]
    .map(([cuisine, visits]) => ({ cuisine, visits }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 8);

  // price spread
  const priceCounts = new Map<number, number>([
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
  ]);
  for (const r of active) priceCounts.set(r.price, (priceCounts.get(r.price) ?? 0) + 1);
  const priceSpread = [...priceCounts.entries()].map(([price, count]) => ({ price, count }));

  // most visited
  const mostVisited = active
    .map((r) => ({ restaurant: r, visits: r.visitCount }))
    .filter((x) => x.visits > 0)
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 5);

  // top rated (need at least one rating)
  const withAvg = restaurants
    .map((r) => ({ restaurant: r, avg: avg(Object.values(r.ratings)) }))
    .filter((x) => Object.keys(x.restaurant.ratings).length > 0);
  const topRated = [...withAvg].sort((a, b) => b.avg - a.avg).slice(0, 5);

  // loved but neglected: high avg, long since visited
  const overdueFavorites = withAvg
    .filter((x) => x.avg >= 7.5 && x.restaurant.status === "active")
    .map((x) => ({ ...x, days: daysSince(x.restaurant.lastVisitAt, now) ?? 9999 }))
    .filter((x) => x.days >= 30)
    .sort((a, b) => b.days - a.days)
    .slice(0, 5);

  // per-profile rating activity
  const perProfile = profiles
    .map((profile) => {
      const scores = restaurants
        .map((r) => r.ratings[profile.id])
        .filter((s): s is number => s !== undefined);
      return { profile, rated: scores.length, avg: avg(scores) };
    })
    .sort((a, b) => b.rated - a.rated);

  // who agrees most: smallest average gap on shared ratings
  let agreement: Insights["agreement"] = null;
  let best = -1;
  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const a = profiles[i];
      const b = profiles[j];
      const gaps: number[] = [];
      for (const r of restaurants) {
        const ra = r.ratings[a.id];
        const rb = r.ratings[b.id];
        if (ra !== undefined && rb !== undefined) gaps.push(Math.abs(ra - rb));
      }
      if (gaps.length >= 3) {
        const closeness = 10 - avg(gaps); // higher = more aligned
        if (closeness > best) {
          best = closeness;
          agreement = { a, b, sharedRatings: gaps.length, closeness };
        }
      }
    }
  }

  const takeoutShare = visits.length
    ? visits.filter((v) => v.mode === "takeout").length / visits.length
    : 0;

  return {
    totalPlaces: restaurants.length,
    totalActive: active.length,
    totalWishlist: wishlist.length,
    totalVisits: visits.length,
    topCuisines,
    visitedCuisines,
    priceSpread,
    mostVisited,
    topRated,
    overdueFavorites,
    perProfile,
    agreement,
    takeoutShare,
  };
}
