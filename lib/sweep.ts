import { db } from "./data";
import { nearbyRestaurants, placesKey } from "./places";

export type SweepResult =
  | { ok: true; baseline: boolean; seen: number; added: number }
  | { ok: false; error: string };

/**
 * Weekly discovery sweep: pull popular restaurants around home and diff
 * against everything we've seen before. The first run just records a
 * baseline so long-established places don't flood the feed as "new".
 */
export async function runDiscoverySweep(): Promise<SweepResult> {
  const key = placesKey();
  if (!key) return { ok: false, error: "GOOGLE_PLACES_API_KEY is not set" };

  const settings = await db().getSettings();
  if (settings.homeLat === null || settings.homeLng === null) {
    return { ok: false, error: "Home location is not set (see Settings)" };
  }

  const places = await nearbyRestaurants(
    settings.homeLat,
    settings.homeLng,
    settings.radiusMeters,
    key
  );

  const seenBefore = new Set(await db().listSeenPlaceIds());
  const baseline = seenBefore.size === 0;
  const unseen = places.filter((p) => !seenBefore.has(p.placeId));

  const restaurants = await db().listRestaurants();
  const trackedIds = new Set(restaurants.map((r) => r.googlePlaceId).filter(Boolean));

  let added = 0;
  if (!baseline) {
    added = await db().upsertDiscoveries(
      unseen
        .filter((p) => !trackedIds.has(p.placeId))
        .map((p) => ({
          placeId: p.placeId,
          name: p.name,
          address: p.address,
          rating: p.rating,
          mapsUrl: p.mapsUrl,
        }))
    );
  }
  await db().markPlacesSeen(places.map((p) => p.placeId));

  return { ok: true, baseline, seen: places.length, added };
}
