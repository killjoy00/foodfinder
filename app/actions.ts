"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearActiveProfile,
  createHousehold,
  loginToHousehold,
  logout,
  requireProfile,
  setActiveProfile,
} from "@/lib/auth";
import { db } from "@/lib/data";
import { NewRestaurant } from "@/lib/data/adapter";
import {
  DEFAULT_FILTERS,
  DEFAULT_VOTE_SIZE,
  buildCandidates,
  buildCuisineRecency,
  collapseChains,
  sampleCandidates,
} from "@/lib/picker";
import { geocodeAddress, zipToCoords } from "@/lib/geocode";
import { distanceMiles } from "@/lib/distance";
import { findRecommendations } from "@/lib/recommend";
import { placesKey } from "@/lib/places";
import { runDiscoverySweep, SweepResult } from "@/lib/sweep";
import { TakeoutItem, starToScore } from "@/lib/takeout";
import { tallyVotes } from "@/lib/vote";
import { RestaurantStatus, Settings, VisitMode } from "@/lib/types";

// ---------- auth & profiles ----------

export async function loginAction(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const name = String(formData.get("group") ?? "");
  const password = String(formData.get("password") ?? "");
  const ok = await loginToHousehold(name, password);
  if (!ok) return { error: "That group name and password don't match." };
  redirect("/profiles");
}

export async function createGroupAction(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const name = String(formData.get("group") ?? "");
  const password = String(formData.get("password") ?? "");
  const result = await createHousehold(name, password);
  if (!result.ok) return { error: result.error ?? "Couldn't create that group." };
  redirect("/profiles");
}

export async function selectProfileAction(profileId: string): Promise<void> {
  await setActiveProfile(profileId);
  redirect("/");
}

export async function switchProfileAction(): Promise<void> {
  await clearActiveProfile();
  redirect("/profiles");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/login");
}

export async function addProfileAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const emoji = String(formData.get("emoji") ?? "🙂").trim() || "🙂";
  const color = String(formData.get("color") ?? "#f97316");
  await (await db()).createProfile(name, emoji, color);
  revalidatePath("/profiles");
  revalidatePath("/settings");
}

export async function updateProfileAction(profileId: string, formData: FormData): Promise<void> {
  await requireProfile();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await (await db()).updateProfile(profileId, {
    name,
    emoji: String(formData.get("emoji") ?? "🙂").trim() || "🙂",
    color: String(formData.get("color") ?? "#f97316"),
  });
  revalidatePath("/profiles");
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function deleteProfileAction(profileId: string): Promise<void> {
  await (await db()).deleteProfile(profileId);
  revalidatePath("/profiles");
}

// ---------- restaurants ----------

function restaurantFromForm(formData: FormData): NewRestaurant {
  const tags: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("tag_") && value === "on") tags.push(key.slice(4));
  }
  const numOrNull = (name: string) => {
    const v = parseFloat(String(formData.get(name) ?? ""));
    return Number.isFinite(v) ? v : null;
  };
  return {
    name: String(formData.get("name") ?? "").trim(),
    cuisines: String(formData.get("cuisines") ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean),
    price: Math.min(4, Math.max(1, parseInt(String(formData.get("price") ?? "2"), 10) || 2)),
    address: String(formData.get("address") ?? "").trim() || null,
    lat: numOrNull("lat"),
    lng: numOrNull("lng"),
    googlePlaceId: String(formData.get("googlePlaceId") ?? "").trim() || null,
    mapsUrl: String(formData.get("mapsUrl") ?? "").trim() || null,
    reserveUrl: String(formData.get("reserveUrl") ?? "").trim() || null,
    tags,
    status: (formData.get("status") === "wishlist" ? "wishlist" : "active") as RestaurantStatus,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

/** Fill in coordinates from the address when they're missing or the address changed. */
async function ensureCoords(data: NewRestaurant, prevAddress?: string | null): Promise<NewRestaurant> {
  const hasCoords = data.lat !== null && data.lng !== null;
  const addressChanged = prevAddress !== undefined && data.address !== (prevAddress ?? null);
  if (data.address && (!hasCoords || addressChanged)) {
    const point = await geocodeAddress(data.address);
    if (point) return { ...data, lat: point.lat, lng: point.lng };
  }
  return data;
}

export async function addRestaurantAction(formData: FormData): Promise<void> {
  await requireProfile();
  const data = await ensureCoords(restaurantFromForm(formData));
  if (!data.name) return;
  const created = await (await db()).createRestaurant(data);
  revalidatePath("/restaurants");
  redirect(`/restaurants/${created.id}`);
}

export async function updateRestaurantAction(id: string, formData: FormData): Promise<void> {
  await requireProfile();
  const adapter = await db();
  const existing = await adapter.getRestaurant(id);
  const data = await ensureCoords(restaurantFromForm(formData), existing?.address ?? null);
  if (!data.name) return;
  await adapter.updateRestaurant(id, data);
  revalidatePath("/restaurants");
  revalidatePath(`/restaurants/${id}`);
}

export async function deleteRestaurantAction(id: string): Promise<void> {
  await requireProfile();
  await (await db()).deleteRestaurant(id);
  revalidatePath("/restaurants");
  redirect("/restaurants");
}

export async function trackRestaurantAction(
  restaurantId: string,
  status: RestaurantStatus
): Promise<void> {
  await requireProfile();
  const adapter = await db();
  await adapter.trackRestaurant(restaurantId, status);
  // catalog seeds (e.g. the Austin list) carry no coordinates; geocode on add
  // so the family's distance filtering works for places they actually track
  const r = await adapter.getRestaurant(restaurantId);
  if (r && (r.lat === null || r.lng === null) && r.address) {
    const point = await geocodeAddress(r.address);
    if (point) await adapter.updateRestaurant(restaurantId, { lat: point.lat, lng: point.lng });
  }
  revalidatePath("/restaurants");
  revalidatePath("/restaurants/browse");
  revalidatePath("/");
}

export async function clearWishlistAction(): Promise<number> {
  await requireProfile();
  const removed = await (await db()).clearWishlist();
  revalidatePath("/restaurants");
  revalidatePath("/");
  return removed;
}

export async function mergeRestaurantsAction(survivorId: string, loserId: string): Promise<void> {
  await requireProfile();
  await (await db()).mergeRestaurants(survivorId, loserId);
  revalidatePath("/restaurants");
  revalidatePath("/restaurants/duplicates");
  revalidatePath("/");
}

export async function setStatusAction(id: string, status: RestaurantStatus): Promise<void> {
  await requireProfile();
  await (await db()).updateRestaurant(id, { status });
  revalidatePath("/restaurants");
  revalidatePath(`/restaurants/${id}`);
  revalidatePath("/");
}

export async function setRatingAction(
  restaurantId: string,
  profileId: string,
  score: number
): Promise<void> {
  await requireProfile();
  if (score < 1 || score > 10) return;
  await (await db()).setRating(restaurantId, profileId, Math.round(score));
  revalidatePath(`/restaurants/${restaurantId}`);
  revalidatePath("/restaurants");
}

// ---------- visits ----------

export async function logVisitAction(
  restaurantId: string,
  mode: VisitMode,
  note?: string
): Promise<void> {
  await requireProfile();
  await (await db()).addVisit(restaurantId, new Date().toISOString(), mode, note?.trim() || null);
  // A visit means it's no longer just a wish.
  const restaurant = await (await db()).getRestaurant(restaurantId);
  if (restaurant?.status === "wishlist") {
    await (await db()).updateRestaurant(restaurantId, { status: "active" });
  }
  revalidatePath("/");
  revalidatePath("/restaurants");
  revalidatePath(`/restaurants/${restaurantId}`);
}

// ---------- family vote ----------

export async function startVoteAction(candidateIds: string[]): Promise<void> {
  await requireProfile();
  if (candidateIds.length < 2) return;
  await (await db()).createVoteSession(candidateIds.slice(0, 8));
  revalidatePath("/vote");
  redirect("/vote");
}

/**
 * Start a vote straight from the Vote tab: weighted-sample candidates
 * from the whole collection using default filters.
 */
export async function startQuickVoteAction(count: number): Promise<void> {
  await requireProfile();
  const size = Math.min(8, Math.max(2, Math.round(count) || DEFAULT_VOTE_SIZE));
  const [restaurants, recentVisits] = await Promise.all([
    (await db()).listRestaurants(),
    (await db()).listRecentVisits(50),
  ]);
  const cuisinesByRestaurant = new Map(restaurants.map((r) => [r.id, r.cuisines]));
  const cuisineRecency = buildCuisineRecency(recentVisits, cuisinesByRestaurant);
  const { regulars, wishlist } = buildCandidates(
    collapseChains(restaurants),
    DEFAULT_FILTERS,
    cuisineRecency
  );
  const candidates = sampleCandidates([...regulars, ...wishlist], size);
  if (candidates.length < 2) return;
  await (await db()).createVoteSession(candidates.map((c) => c.restaurant.id));
  revalidatePath("/vote");
}

export async function castVoteAction(
  sessionId: string,
  pickId: string | null,
  vetoId: string | null,
  deferred: boolean = false
): Promise<void> {
  const profile = await requireProfile();
  const adapter = await db();
  const session = await adapter.getVoteSession(sessionId);
  if (!session || session.status !== "open") return;
  // deferral is final for the round — once you defer you're out, no take-backs
  const mine = (await adapter.listVotes(sessionId)).find((v) => v.profileId === profile.id);
  if (mine?.deferred) return;
  if (deferred) {
    await adapter.castVote(sessionId, profile.id, null, null, true);
  } else {
    if (pickId && vetoId && pickId === vetoId) return;
    await adapter.castVote(sessionId, profile.id, pickId, vetoId, false);
  }
  revalidatePath("/vote");
}

export async function closeVoteAction(sessionId: string): Promise<void> {
  await requireProfile();
  const session = await (await db()).getVoteSession(sessionId);
  if (!session || session.status !== "open") return;
  const [votes, profiles] = await Promise.all([(await db()).listVotes(sessionId), (await db()).listProfiles()]);

  // a banked double-vote credit makes this round's pick count twice
  const creditOf = new Map(profiles.map((p) => [p.id, p.doubleCredits]));
  const weightOf = (profileId: string) => ((creditOf.get(profileId) ?? 0) > 0 ? 2 : 1);
  const winnerId = tallyVotes(session.candidateIds, votes, Math.random, weightOf);
  await (await db()).closeVoteSession(sessionId, winnerId);

  // settle credits: bank one per deferral, spend one when a credit was used
  for (const v of votes) {
    const credits = creditOf.get(v.profileId) ?? 0;
    if (v.deferred) {
      await (await db()).setDoubleCredits(v.profileId, credits + 1);
    } else if (v.pickId && credits > 0) {
      await (await db()).setDoubleCredits(v.profileId, credits - 1);
    }
  }
  revalidatePath("/vote");
}

export async function cancelVoteAction(sessionId: string): Promise<void> {
  await requireProfile();
  await (await db()).closeVoteSession(sessionId, null);
  revalidatePath("/vote");
}

// ---------- discovery & recommendations ----------

export async function dismissDiscoveryAction(placeId: string): Promise<void> {
  await requireProfile();
  await (await db()).dismissDiscovery(placeId);
  revalidatePath("/discover");
}

export async function addDiscoveryToWishlistAction(placeId: string): Promise<void> {
  await requireProfile();
  const discoveries = await (await db()).listDiscoveries();
  const d = discoveries.find((x) => x.placeId === placeId);
  if (!d) return;
  const point = d.address ? await geocodeAddress(d.address) : null;
  await (await db()).createRestaurant({
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
  await (await db()).dismissDiscovery(placeId);
  revalidatePath("/discover");
  revalidatePath("/restaurants");
}

export async function runSweepAction(): Promise<SweepResult> {
  await requireProfile();
  const result = await runDiscoverySweep(await db());
  revalidatePath("/discover");
  return result;
}

export type RecommendationGroup = {
  cuisine: string;
  places: {
    placeId: string;
    name: string;
    address: string | null;
    rating: number | null;
    mapsUrl: string | null;
    lat: number | null;
    lng: number | null;
    distanceMiles: number | null;
  }[];
};

export async function fetchRecommendationsAction(radiusMiles?: number): Promise<
  { ok: true; groups: RecommendationGroup[] } | { ok: false; error: string }
> {
  await requireProfile();
  const key = placesKey();
  if (!key) return { ok: false, error: "GOOGLE_PLACES_API_KEY is not set" };
  const settings = await (await db()).getSettings();
  if (settings.homeLat === null || settings.homeLng === null) {
    return { ok: false, error: "Set your home location in Settings first." };
  }
  // a per-search radius overrides the saved default when provided
  const radiusMeters =
    radiusMiles && radiusMiles > 0
      ? Math.round(Math.min(radiusMiles, 50) * 1609.34)
      : settings.radiusMeters;
  const restaurants = await (await db()).listRestaurants();
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

export async function addRecommendationToWishlistAction(place: {
  placeId: string;
  name: string;
  address: string | null;
  mapsUrl: string | null;
  cuisine: string;
  lat: number | null;
  lng: number | null;
}): Promise<void> {
  await requireProfile();
  await (await db()).createRestaurant({
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
  revalidatePath("/restaurants");
}

// ---------- import ----------

export async function importTakeoutAction(
  items: TakeoutItem[]
): Promise<{ imported: number; skipped: number }> {
  const profile = await requireProfile();
  const existing = await (await db()).listRestaurants();
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
    const created = await (await db()).createRestaurant({
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
      await (await db()).setRating(created.id, profile.id, starToScore(item.starRating));
    }
    knownNames.add(item.name.toLowerCase());
    if (item.placeId) knownIds.add(item.placeId);
    imported++;
  }
  revalidatePath("/restaurants");
  return { imported, skipped };
}

// ---------- settings ----------

export async function saveLocationAction(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  await requireProfile();
  const num = (name: string) => {
    const v = parseFloat(String(formData.get(name) ?? ""));
    return Number.isFinite(v) ? v : null;
  };
  const radiusMeters = Math.round(((num("radiusMiles") ?? 5) * 1609.34) || 8000);
  const zip = String(formData.get("zip") ?? "").trim();
  const manualLat = num("homeLat");
  const manualLng = num("homeLng");

  let settings: Settings;
  if (zip) {
    const hit = await zipToCoords(zip);
    if (!hit) {
      return { ok: false, message: `Couldn't find ZIP code "${zip}" — double-check it?` };
    }
    settings = {
      homeLabel: `${hit.label} (${zip})`,
      homeLat: hit.lat,
      homeLng: hit.lng,
      radiusMeters,
    };
  } else if (manualLat !== null && manualLng !== null) {
    settings = {
      homeLabel: String(formData.get("homeLabel") ?? "").trim() || "Home",
      homeLat: manualLat,
      homeLng: manualLng,
      radiusMeters,
    };
  } else {
    return { ok: false, message: "Enter a ZIP code (or coordinates under Advanced)." };
  }

  await (await db()).saveSettings(settings);
  revalidatePath("/settings");
  revalidatePath("/discover");
  return { ok: true, message: `Home set to ${settings.homeLabel} ✓` };
}
