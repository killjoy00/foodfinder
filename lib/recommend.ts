import { RestaurantFull } from "./types";
import { PlaceResult, textSearch } from "./places";
import { distanceMiles } from "./distance";

export type TasteProfile = {
  topCuisines: { cuisine: string; score: number }[];
  preferredMaxPrice: number;
};

/**
 * Content-based taste profile from the family's own ratings: which
 * cuisines do well-rated places have, and what do you usually spend.
 */
export function buildTasteProfile(restaurants: RestaurantFull[]): TasteProfile {
  const cuisineScores = new Map<string, { total: number; count: number }>();
  const prices: number[] = [];

  for (const r of restaurants) {
    const scores = Object.values(r.ratings);
    if (scores.length === 0) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    prices.push(r.price);
    for (const cuisine of r.cuisines) {
      const key = cuisine.trim();
      if (!key) continue;
      const entry = cuisineScores.get(key) ?? { total: 0, count: 0 };
      entry.total += avg;
      entry.count += 1;
      cuisineScores.set(key, entry);
    }
  }

  const topCuisines = [...cuisineScores.entries()]
    .map(([cuisine, { total, count }]) => ({
      // average quality with a mild boost for cuisines you return to
      cuisine,
      score: (total / count) * Math.min(1.5, 1 + count / 10),
    }))
    .filter((c) => c.score >= 6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  prices.sort((a, b) => a - b);
  const preferredMaxPrice = prices.length
    ? Math.min(4, prices[Math.floor(prices.length * 0.8)] + 1)
    : 4;

  return { topCuisines, preferredMaxPrice };
}

/**
 * Query Places for well-rated restaurants in your favorite cuisines near
 * home, excluding everything already tracked.
 */
export async function findRecommendations(
  restaurants: RestaurantFull[],
  home: { lat: number; lng: number; radiusMeters: number },
  key: string
): Promise<{ cuisine: string; places: PlaceResult[] }[]> {
  const profile = buildTasteProfile(restaurants);
  const knownIds = new Set(restaurants.map((r) => r.googlePlaceId).filter(Boolean));
  const knownNames = new Set(restaurants.map((r) => r.name.toLowerCase()));

  // Google's locationBias only *prefers* nearby results, so enforce the
  // radius ourselves by measuring distance from home.
  const radiusMiles = home.radiusMeters / 1609.34;
  const withinRadius = (p: PlaceResult) => {
    const d = distanceMiles({ lat: home.lat, lng: home.lng }, { lat: p.lat, lng: p.lng });
    return d !== null && d <= radiusMiles;
  };

  const results: { cuisine: string; places: PlaceResult[] }[] = [];
  for (const { cuisine } of profile.topCuisines.slice(0, 3)) {
    const places = await textSearch(`best ${cuisine} restaurant`, key, home, true);
    const fresh = places
      .filter((p) => !knownIds.has(p.placeId) && !knownNames.has(p.name.toLowerCase()))
      .filter(withinRadius)
      .filter((p) => (p.rating ?? 0) >= 4.2)
      .filter((p) => p.priceLevel === null || p.priceLevel <= profile.preferredMaxPrice)
      .slice(0, 5);
    if (fresh.length > 0) results.push({ cuisine, places: fresh });
  }
  return results;
}
