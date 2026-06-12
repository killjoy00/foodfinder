"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearActiveProfile, login, requireProfile, setActiveProfile } from "@/lib/auth";
import { db } from "@/lib/data";
import { NewRestaurant } from "@/lib/data/adapter";
import {
  DEFAULT_FILTERS,
  DEFAULT_VOTE_SIZE,
  buildCandidates,
  sampleCandidates,
} from "@/lib/picker";
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
  const ok = await login(String(formData.get("password") ?? ""));
  if (!ok) return { error: "That's not the family password." };
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

export async function addProfileAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const emoji = String(formData.get("emoji") ?? "🙂").trim() || "🙂";
  const color = String(formData.get("color") ?? "#f97316");
  await db().createProfile(name, emoji, color);
  revalidatePath("/profiles");
}

export async function deleteProfileAction(profileId: string): Promise<void> {
  await db().deleteProfile(profileId);
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

export async function addRestaurantAction(formData: FormData): Promise<void> {
  await requireProfile();
  const data = restaurantFromForm(formData);
  if (!data.name) return;
  const created = await db().createRestaurant(data);
  revalidatePath("/restaurants");
  redirect(`/restaurants/${created.id}`);
}

export async function updateRestaurantAction(id: string, formData: FormData): Promise<void> {
  await requireProfile();
  const data = restaurantFromForm(formData);
  if (!data.name) return;
  await db().updateRestaurant(id, data);
  revalidatePath("/restaurants");
  revalidatePath(`/restaurants/${id}`);
}

export async function deleteRestaurantAction(id: string): Promise<void> {
  await requireProfile();
  await db().deleteRestaurant(id);
  revalidatePath("/restaurants");
  redirect("/restaurants");
}

export async function setStatusAction(id: string, status: RestaurantStatus): Promise<void> {
  await requireProfile();
  await db().updateRestaurant(id, { status });
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
  await db().setRating(restaurantId, profileId, Math.round(score));
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
  await db().addVisit(restaurantId, new Date().toISOString(), mode, note?.trim() || null);
  // A visit means it's no longer just a wish.
  const restaurant = await db().getRestaurant(restaurantId);
  if (restaurant?.status === "wishlist") {
    await db().updateRestaurant(restaurantId, { status: "active" });
  }
  revalidatePath("/");
  revalidatePath("/restaurants");
  revalidatePath(`/restaurants/${restaurantId}`);
}

// ---------- family vote ----------

export async function startVoteAction(candidateIds: string[]): Promise<void> {
  await requireProfile();
  if (candidateIds.length < 2) return;
  await db().createVoteSession(candidateIds.slice(0, 8));
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
    db().listRestaurants(),
    db().listRecentVisits(3),
  ]);
  const byId = new Map(restaurants.map((r) => [r.id, r]));
  const recentCuisines = recentVisits.map((v) => byId.get(v.restaurantId)?.cuisines ?? []);
  const { regulars, wishlist } = buildCandidates(restaurants, DEFAULT_FILTERS, recentCuisines);
  const candidates = sampleCandidates([...regulars, ...wishlist], size);
  if (candidates.length < 2) return;
  await db().createVoteSession(candidates.map((c) => c.restaurant.id));
  revalidatePath("/vote");
}

export async function castVoteAction(
  sessionId: string,
  pickId: string | null,
  vetoId: string | null
): Promise<void> {
  const profile = await requireProfile();
  const session = await db().getVoteSession(sessionId);
  if (!session || session.status !== "open") return;
  if (pickId && vetoId && pickId === vetoId) return;
  await db().castVote(sessionId, profile.id, pickId, vetoId);
  revalidatePath("/vote");
}

export async function closeVoteAction(sessionId: string): Promise<void> {
  await requireProfile();
  const session = await db().getVoteSession(sessionId);
  if (!session || session.status !== "open") return;
  const votes = await db().listVotes(sessionId);
  const winnerId = tallyVotes(session.candidateIds, votes);
  await db().closeVoteSession(sessionId, winnerId);
  revalidatePath("/vote");
}

export async function cancelVoteAction(sessionId: string): Promise<void> {
  await requireProfile();
  await db().closeVoteSession(sessionId, null);
  revalidatePath("/vote");
}

// ---------- discovery & recommendations ----------

export async function dismissDiscoveryAction(placeId: string): Promise<void> {
  await requireProfile();
  await db().dismissDiscovery(placeId);
  revalidatePath("/discover");
}

export async function addDiscoveryToWishlistAction(placeId: string): Promise<void> {
  await requireProfile();
  const discoveries = await db().listDiscoveries();
  const d = discoveries.find((x) => x.placeId === placeId);
  if (!d) return;
  await db().createRestaurant({
    name: d.name,
    cuisines: [],
    price: 2,
    address: d.address,
    lat: null,
    lng: null,
    googlePlaceId: d.placeId,
    mapsUrl: d.mapsUrl,
    reserveUrl: null,
    tags: [],
    status: "wishlist",
    notes: "From the discovery feed",
  });
  await db().dismissDiscovery(placeId);
  revalidatePath("/discover");
  revalidatePath("/restaurants");
}

export async function runSweepAction(): Promise<SweepResult> {
  await requireProfile();
  const result = await runDiscoverySweep();
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
  }[];
};

export async function fetchRecommendationsAction(): Promise<
  { ok: true; groups: RecommendationGroup[] } | { ok: false; error: string }
> {
  await requireProfile();
  const key = placesKey();
  if (!key) return { ok: false, error: "GOOGLE_PLACES_API_KEY is not set" };
  const settings = await db().getSettings();
  if (settings.homeLat === null || settings.homeLng === null) {
    return { ok: false, error: "Set your home location in Settings first." };
  }
  const restaurants = await db().listRestaurants();
  try {
    const groups = await findRecommendations(
      restaurants,
      { lat: settings.homeLat, lng: settings.homeLng, radiusMeters: settings.radiusMeters },
      key
    );
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
}): Promise<void> {
  await requireProfile();
  await db().createRestaurant({
    name: place.name,
    cuisines: place.cuisine ? [place.cuisine] : [],
    price: 2,
    address: place.address,
    lat: null,
    lng: null,
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
  const existing = await db().listRestaurants();
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
    const created = await db().createRestaurant({
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
      await db().setRating(created.id, profile.id, starToScore(item.starRating));
    }
    knownNames.add(item.name.toLowerCase());
    if (item.placeId) knownIds.add(item.placeId);
    imported++;
  }
  revalidatePath("/restaurants");
  return { imported, skipped };
}

// ---------- settings ----------

export async function saveSettingsAction(formData: FormData): Promise<void> {
  await requireProfile();
  const num = (name: string) => {
    const v = parseFloat(String(formData.get(name) ?? ""));
    return Number.isFinite(v) ? v : null;
  };
  const settings: Settings = {
    homeLabel: String(formData.get("homeLabel") ?? "").trim() || null,
    homeLat: num("homeLat"),
    homeLng: num("homeLng"),
    radiusMeters: Math.round(((num("radiusMiles") ?? 5) * 1609.34) || 8000),
  };
  await db().saveSettings(settings);
  revalidatePath("/settings");
}
