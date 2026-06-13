import { DataAdapter } from "./data/adapter";
import { nearbyRestaurants, placesKey } from "./places";

export type SweepResult =
  | { ok: true; baseline: boolean; seen: number; added: number }
  | { ok: false; error: string };

/**
 * Discovery sweep for one group: pull popular restaurants around that
 * group's home and diff against what it has seen before. The first run just
 * records a baseline so long-established places don't flood the feed.
 */
export async function runDiscoverySweep(adapter: DataAdapter): Promise<SweepResult> {
  const key = placesKey();
  if (!key) return { ok: false, error: "GOOGLE_PLACES_API_KEY is not set" };

  const settings = await adapter.getSettings();
  if (settings.homeLat === null || settings.homeLng === null) {
    return { ok: false, error: "Home location is not set (see Settings)" };
  }

  const places = await nearbyRestaurants(
    settings.homeLat,
    settings.homeLng,
    settings.radiusMeters,
    key
  );

  const seenBefore = new Set(await adapter.listSeenPlaceIds());
  const baseline = seenBefore.size === 0;
  const unseen = places.filter((p) => !seenBefore.has(p.placeId));

  const restaurants = await adapter.listRestaurants();
  const trackedIds = new Set(restaurants.map((r) => r.googlePlaceId).filter(Boolean));

  let added = 0;
  if (!baseline) {
    added = await adapter.upsertDiscoveries(
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
  await adapter.markPlacesSeen(places.map((p) => p.placeId));

  return { ok: true, baseline, seen: places.length, added };
}
