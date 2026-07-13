import { DataAdapter, NewRestaurant } from "./data/adapter";
import { distanceMiles } from "./distance";
import { geocodeAddress, zipToCoords } from "./geocode";
import {
  DEFAULT_FILTERS,
  DEFAULT_VOTE_SIZE,
  buildCandidates,
  buildCuisineRecency,
  collapseChains,
  sampleCandidates,
} from "./picker";
import { placesKey } from "./places";
import { findRecommendations } from "./recommend";
import { TakeoutItem, starToScore } from "./takeout";
import { Settings, VisitMode, VoteSession } from "./types";
import { tallyVotes } from "./vote";

/**
 * Business logic shared by the web app's server actions (app/actions.ts)
 * and the mobile REST API (app/api/mobile/*). Everything takes the
 * already-scoped DataAdapter so it stays independent of how the request
 * was authenticated.
 */

// ---------- restaurants ----------

export type RestaurantInput = Partial<{
  name: string;
  cuisines: string[];
  price: number;
  address: string | null;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
  mapsUrl: string | null;
  reserveUrl: string | null;
  tags: string[];
  status: string;
  notes: string | null;
}>;

/** Clamp/clean an untrusted restaurant payload into a NewRestaurant. */
export function normalizeRestaurantInput(body: RestaurantInput): NewRestaurant {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    name: str(body.name),
    cuisines: Array.isArray(body.cuisines) ? body.cuisines.map((c) => str(c)).filter(Boolean) : [],
    price: Math.min(4, Math.max(1, Math.round(Number(body.price)) || 2)),
    address: str(body.address) || null,
    lat: numOrNull(body.lat),
    lng: numOrNull(body.lng),
    googlePlaceId: str(body.googlePlaceId) || null,
    mapsUrl: str(body.mapsUrl) || null,
    reserveUrl: str(body.reserveUrl) || null,
    tags: Array.isArray(body.tags) ? body.tags.map((t) => str(t)).filter(Boolean) : [],
    status: body.status === "wishlist" ? "wishlist" : "active",
    notes: str(body.notes) || null,
  };
}

/** Fill in coordinates from the address when they're missing or the address changed. */
export async function ensureCoords(
  data: NewRestaurant,
  prevAddress?: string | null
): Promise<NewRestaurant> {
  const hasCoords = data.lat !== null && data.lng !== null;
  const addressChanged = prevAddress !== undefined && data.address !== (prevAddress ?? null);
  if (data.address && (!hasCoords || addressChanged)) {
    const point = await geocodeAddress(data.address);
    if (point) return { ...data, lat: point.lat, lng: point.lng };
  }
  return data;
}

/**
 * Track a catalog location under its brand. Catalog seeds (e.g. the Austin
 * list) carry no coordinates; geocode on add so distance filtering works.
 */
export async function trackRestaurantWithGeocode(
  adapter: DataAdapter,
  restaurantId: string,
  status: "active" | "wishlist"
): Promise<void> {
  await adapter.trackRestaurant(restaurantId, status);
  const loc = await adapter.getCatalogLocation(restaurantId);
  if (loc && (loc.lat === null || loc.lng === null) && loc.address) {
    const point = await geocodeAddress(loc.address);
    if (point) await adapter.setLocationCoords(restaurantId, point.lat, point.lng);
  }
}

// ---------- visits ----------

/** Log a visit; a visit means the place is no longer just a wish. */
export async function logVisit(
  adapter: DataAdapter,
  restaurantId: string,
  mode: VisitMode,
  note?: string | null
): Promise<void> {
  await adapter.addVisit(restaurantId, new Date().toISOString(), mode, note?.trim() || null);
  const restaurant = await adapter.getRestaurant(restaurantId);
  if (restaurant?.status === "wishlist") {
    await adapter.updateRestaurant(restaurantId, { status: "active" });
  }
}

// ---------- family vote ----------

/**
 * Start a vote straight from the Vote tab: weighted-sample candidates
 * from the whole collection using default filters. Returns the session,
 * or null when there aren't enough candidates.
 */
export async function startQuickVote(
  adapter: DataAdapter,
  count: number
): Promise<VoteSession | null> {
  const size = Math.min(8, Math.max(2, Math.round(count) || DEFAULT_VOTE_SIZE));
  const [restaurants, recentVisits] = await Promise.all([
    adapter.listRestaurants(),
    adapter.listRecentVisits(50),
  ]);
  const cuisinesByRestaurant = new Map(restaurants.map((r) => [r.id, r.cuisines]));
  const cuisineRecency = buildCuisineRecency(recentVisits, cuisinesByRestaurant);
  const { regulars, wishlist } = buildCandidates(
    collapseChains(restaurants),
    DEFAULT_FILTERS,
    cuisineRecency
  );
  const candidates = sampleCandidates([...regulars, ...wishlist], size);
  if (candidates.length < 2) return null;
  return adapter.createVoteSession(candidates.map((c) => c.restaurant.id));
}

/** Cast (or defer) a vote. Deferral is final for the round — no take-backs. */
export async function castVote(
  adapter: DataAdapter,
  profileId: string,
  sessionId: string,
  pickId: string | null,
  vetoId: string | null,
  deferred: boolean
): Promise<void> {
  const session = await adapter.getVoteSession(sessionId);
  if (!session || session.status !== "open") return;
  const mine = (await adapter.listVotes(sessionId)).find((v) => v.profileId === profileId);
  if (mine?.deferred) return;
  if (deferred) {
    await adapter.castVote(sessionId, profileId, null, null, true);
  } else {
    if (pickId && vetoId && pickId === vetoId) return;
    await adapter.castVote(sessionId, profileId, pickId, vetoId, false);
  }
}

/** Close a vote: tally with double-credit weighting, then settle credits. */
export async function closeVote(adapter: DataAdapter, sessionId: string): Promise<void> {
  const session = await adapter.getVoteSession(sessionId);
  if (!session || session.status !== "open") return;
  const [votes, profiles] = await Promise.all([
    adapter.listVotes(sessionId),
    adapter.listProfiles(),
  ]);

  // a banked double-vote credit makes this round's pick count twice
  const creditOf = new Map(profiles.map((p) => [p.id, p.doubleCredits]));
  const weightOf = (profileId: string) => ((creditOf.get(profileId) ?? 0) > 0 ? 2 : 1);
  const winnerId = tallyVotes(session.candidateIds, votes, Math.random, weightOf);
  await adapter.closeVoteSession(sessionId, winnerId);

  // settle credits: bank one per deferral, spend one when a credit was used
  for (const v of votes) {
    const credits = creditOf.get(v.profileId) ?? 0;
    if (v.deferred) {
      await adapter.setDoubleCredits(v.profileId, credits + 1);
    } else if (v.pickId && credits > 0) {
      await adapter.setDoubleCredits(v.profileId, credits - 1);
    }
  }
}

// ---------- discovery & recommendations ----------

/** Move a discovery-feed place onto the wishlist. Returns false when unknown. */
export async function addDiscoveryToWishlist(
  adapter: DataAdapter,
  placeId: string
): Promise<boolean> {
  const discoveries = await adapter.listDiscoveries();
  const d = discoveries.find((x) => x.placeId === placeId);
  if (!d) return false;
  const point = d.address ? await geocodeAddress(d.address) : null;
  await adapter.createRestaurant({
    name: d.name,
    cuisines: [],
    price: 2,
    address: d.address,
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    googlePlaceId: d.placeId,
    mapsUrl: d.mapsUrl,
    reserveUrl: null,
    tags: [],
    status: "wishlist",
    notes: "From the discovery feed",
  });
  await adapter.dismissDiscovery(placeId);
  return true;
}

export type RecommendedPlace = {
  placeId: string;
  name: string;
  address: string | null;
  rating: number | null;
  mapsUrl: string | null;
  lat: number | null;
  lng: number | null;
  distanceMiles: number | null;
};

export type RecommendationGroup = {
  cuisine: string;
  places: RecommendedPlace[];
};

export async function fetchRecommendationGroups(
  adapter: DataAdapter,
  radiusMiles?: number
): Promise<{ ok: true; groups: RecommendationGroup[] } | { ok: false; error: string }> {
  const key = placesKey();
  if (!key) return { ok: false, error: "GOOGLE_PLACES_API_KEY is not set" };
  const settings = await adapter.getSettings();
  if (settings.homeLat === null || settings.homeLng === null) {
    return { ok: false, error: "Set your home location in Settings first." };
  }
  // a per-search radius overrides the saved default when provided
  const radiusMeters =
    radiusMiles && radiusMiles > 0
      ? Math.round(Math.min(radiusMiles, 50) * 1609.34)
      : settings.radiusMeters;
  const restaurants = await adapter.listRestaurants();
  const home = { lat: settings.homeLat, lng: settings.homeLng };
  try {
    const raw = await findRecommendations(restaurants, { ...home, radiusMeters }, key);
    const groups: RecommendationGroup[] = raw.map((g) => ({
      cuisine: g.cuisine,
      places: g.places.map((p) => ({
        placeId: p.placeId,
        name: p.name,
        address: p.address,
        rating: p.rating,
        mapsUrl: p.mapsUrl,
        lat: p.lat,
        lng: p.lng,
        distanceMiles: distanceMiles(home, { lat: p.lat, lng: p.lng }),
      })),
    }));
    return { ok: true, groups };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Recommendation lookup failed" };
  }
}

export type RecommendationPick = {
  placeId: string;
  name: string;
  address: string | null;
  mapsUrl: string | null;
  cuisine: string;
  lat: number | null;
  lng: number | null;
};

export async function addRecommendationToWishlist(
  adapter: DataAdapter,
  place: RecommendationPick
): Promise<void> {
  await adapter.createRestaurant({
    name: place.name,
    cuisines: place.cuisine ? [place.cuisine] : [],
    price: 2,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    googlePlaceId: place.placeId,
    mapsUrl: place.mapsUrl,
    reserveUrl: null,
    tags: [],
    status: "wishlist",
    notes: "Recommended based on your ratings",
  });
}

// ---------- import ----------

export async function importTakeout(
  adapter: DataAdapter,
  profileId: string,
  items: TakeoutItem[]
): Promise<{ imported: number; skipped: number }> {
  const existing = await adapter.listRestaurants();
  const knownIds = new Set(existing.map((r) => r.googlePlaceId).filter(Boolean));
  const knownNames = new Set(existing.map((r) => r.name.toLowerCase()));

  let imported = 0;
  let skipped = 0;
  for (const item of items.slice(0, 500)) {
    const dupe =
      (item.placeId && knownIds.has(item.placeId)) || knownNames.has(item.name.toLowerCase());
    if (dupe || !item.name) {
      skipped++;
      continue;
    }
    const created = await adapter.createRestaurant({
      name: item.name,
      cuisines: [],
      price: 2,
      address: item.address,
      lat: item.lat,
      lng: item.lng,
      googlePlaceId: item.placeId,
      mapsUrl: item.mapsUrl,
      reserveUrl: null,
      tags: [],
      status: item.kind === "review" ? "active" : "wishlist",
      notes: null,
    });
    if (item.starRating !== null) {
      await adapter.setRating(created.id, profileId, starToScore(item.starRating));
    }
    knownNames.add(item.name.toLowerCase());
    if (item.placeId) knownIds.add(item.placeId);
    imported++;
  }
  return { imported, skipped };
}

// ---------- settings ----------

export type HomeLocationInput = {
  zip?: string;
  homeLabel?: string;
  homeLat?: number | null;
  homeLng?: number | null;
  radiusMiles?: number | null;
};

/** Set the home location from a ZIP code or manual coordinates. */
export async function saveHomeLocation(
  adapter: DataAdapter,
  input: HomeLocationInput
): Promise<{ ok: boolean; message: string }> {
  const radiusMeters = Math.round((input.radiusMiles ?? 5) * 1609.34 || 8000);
  const zip = input.zip?.trim() ?? "";

  const prev = await adapter.getSettings(); // preserve cuisineOverrides etc.
  let settings: Settings;
  if (zip) {
    const hit = await zipToCoords(zip);
    if (!hit) {
      return { ok: false, message: `Couldn't find ZIP code "${zip}" — double-check it?` };
    }
    settings = { ...prev, homeLabel: `${hit.label} (${zip})`, homeLat: hit.lat, homeLng: hit.lng, radiusMeters };
  } else if (input.homeLat != null && input.homeLng != null) {
    settings = {
      ...prev,
      homeLabel: input.homeLabel?.trim() || "Home",
      homeLat: input.homeLat,
      homeLng: input.homeLng,
      radiusMeters,
    };
  } else {
    return { ok: false, message: "Enter a ZIP code (or coordinates under Advanced)." };
  }

  await adapter.saveSettings(settings);
  return { ok: true, message: `Home set to ${settings.homeLabel} ✓` };
}
