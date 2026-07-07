"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  changeGroupPassword,
  clearActiveProfile,
  createHousehold,
  loginToHousehold,
  logout,
  requireProfile,
  setActiveProfile,
} from "@/lib/auth";
import { db } from "@/lib/data";
import { CatalogInput, NewRestaurant } from "@/lib/data/adapter";
import {
  DEFAULT_FILTERS,
  DEFAULT_VOTE_SIZE,
  buildCandidates,
  buildCuisineRecency,
  collapseChains,
  pickWeighted,
  sampleCandidates,
  weighCandidate,
} from "@/lib/picker";
import { geocodeAddress, zipToCoords } from "@/lib/geocode";
import { distanceMiles } from "@/lib/distance";
import { findRecommendations } from "@/lib/recommend";
import { placesKey } from "@/lib/places";
import { runDiscoverySweep, SweepResult } from "@/lib/sweep";
import { TakeoutItem, starToScore } from "@/lib/takeout";
import { nominationCandidates, tallyVotes } from "@/lib/vote";
import {
  NOMINATIONS_PER_PROFILE,
  RestaurantFull,
  RestaurantStatus,
  Settings,
  VisitMode,
} from "@/lib/types";

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

export async function changePasswordAction(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  await requireProfile();
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (next !== confirm) return { ok: false, message: "The two passwords don't match." };
  const result = await changeGroupPassword(next);
  return result.ok
    ? { ok: true, message: "Password updated. Everyone uses the new one next time they log in." }
    : { ok: false, message: result.error ?? "Couldn't update the password." };
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
  // the adapter applies brand fields (name/status/notes/cuisines as a per-family
  // override) and pushes catalog facts down only when the brand is one location
  await adapter.updateRestaurant(id, data);
  revalidatePath("/restaurants");
  revalidatePath(`/restaurants/${id}`);
  revalidatePath("/");
}

export async function deleteRestaurantAction(id: string): Promise<void> {
  await requireProfile();
  await (await db()).deleteRestaurant(id);
  revalidatePath("/restaurants");
  redirect("/restaurants");
}

export async function importCatalogAction(entries: CatalogInput[]): Promise<number> {
  await requireProfile();
  const added = await (await db()).addCatalogEntries(entries.slice(0, 6000));
  revalidatePath("/restaurants/browse");
  return added;
}

export async function trackRestaurantAction(
  restaurantId: string,
  status: RestaurantStatus
): Promise<void> {
  await requireProfile();
  const adapter = await db();
  await adapter.trackRestaurant(restaurantId, status);
  // catalog seeds (e.g. the Austin list) carry no coordinates; geocode the
  // location on add so the family's distance filtering works
  const loc = await adapter.getCatalogLocation(restaurantId);
  if (loc && (loc.lat === null || loc.lng === null) && loc.address) {
    const point = await geocodeAddress(loc.address);
    if (point) await adapter.setLocationCoords(restaurantId, point.lat, point.lng);
  }
  revalidatePath("/restaurants");
  revalidatePath("/restaurants/browse");
  revalidatePath("/");
}

/** Split one location out of a brand into its own entry. */
export async function splitLocationAction(brandId: string, restaurantId: string): Promise<void> {
  await requireProfile();
  const newBrandId = await (await db()).splitLocation(brandId, restaurantId);
  revalidatePath("/restaurants");
  revalidatePath(`/restaurants/${brandId}`);
  if (newBrandId) revalidatePath(`/restaurants/${newBrandId}`);
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

export async function clearRatingAction(restaurantId: string, profileId: string): Promise<void> {
  await requireProfile();
  await (await db()).clearRating(restaurantId, profileId);
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
    // a pick or veto has to be one of this session's candidates
    if (pickId && !session.candidateIds.includes(pickId)) return;
    if (vetoId && !session.candidateIds.includes(vetoId)) return;
    await adapter.castVote(sessionId, profile.id, pickId, vetoId, false);
  }
  revalidatePath("/vote");
}

export async function closeVoteAction(sessionId: string): Promise<void> {
  await requireProfile();
  const adapter = await db();
  const session = await adapter.getVoteSession(sessionId);
  if (!session || session.status !== "open") return;
  const [votes, profiles] = await Promise.all([adapter.listVotes(sessionId), adapter.listProfiles()]);
  // closing an untouched ballot shouldn't crown a random winner
  if (votes.length === 0) return;

  // a banked double-vote credit makes this round's pick count twice
  const creditOf = new Map(profiles.map((p) => [p.id, p.doubleCredits]));
  const weightOf = (profileId: string) => ((creditOf.get(profileId) ?? 0) > 0 ? 2 : 1);
  const winnerId = tallyVotes(session.candidateIds, votes, Math.random, weightOf);
  // only the close that actually flips the session settles credits, so two
  // people tapping "Close" at once can't bank or spend them twice
  if (!(await adapter.closeVoteSession(sessionId, winnerId))) return;

  // settle credits: bank one per deferral, spend one when a credit was used
  for (const v of votes) {
    const credits = creditOf.get(v.profileId) ?? 0;
    if (v.deferred) {
      await adapter.setDoubleCredits(v.profileId, credits + 1);
    } else if (v.pickId && credits > 0) {
      await adapter.setDoubleCredits(v.profileId, credits - 1);
    }
  }
  revalidatePath("/vote");
}

export async function cancelVoteAction(sessionId: string): Promise<void> {
  await requireProfile();
  await (await db()).closeVoteSession(sessionId, null);
  revalidatePath("/vote");
}

// ---------- nomination rounds ----------

export async function startNominationRoundAction(): Promise<void> {
  await requireProfile();
  await (await db()).createNominationSession();
  revalidatePath("/vote");
}

/** Nominate one of the family's tracked places into an open nomination round. */
export async function nominateAction(sessionId: string, brandId: string): Promise<void> {
  const profile = await requireProfile();
  const adapter = await db();
  const session = await adapter.getVoteSession(sessionId);
  if (!session || session.status !== "nominating") return;
  if (!(await adapter.getRestaurant(brandId))) return;
  const mine = (await adapter.listNominations(sessionId)).filter((n) => n.profileId === profile.id);
  if (mine.length >= NOMINATIONS_PER_PROFILE) return;
  await adapter.addNomination(sessionId, profile.id, brandId);
  revalidatePath("/vote");
}

/**
 * Nominate a brand-new place (e.g. from Google autocomplete): it joins the
 * family's list as a wishlist entry through the normal create flow, then
 * gets nominated. If the place matches an existing brand, that brand is
 * nominated instead of creating a duplicate.
 */
export async function nominateNewPlaceAction(
  sessionId: string,
  place: {
    name: string;
    address: string | null;
    lat: number | null;
    lng: number | null;
    googlePlaceId: string | null;
    mapsUrl: string | null;
    priceLevel: number | null;
    cuisines: string[];
  }
): Promise<void> {
  const profile = await requireProfile();
  const adapter = await db();
  const session = await adapter.getVoteSession(sessionId);
  if (!session || session.status !== "nominating") return;
  const name = place.name.trim();
  if (!name) return;
  const mine = (await adapter.listNominations(sessionId)).filter((n) => n.profileId === profile.id);
  if (mine.length >= NOMINATIONS_PER_PROFILE) return;
  const created = await adapter.createRestaurant(
    await ensureCoords({
      name,
      cuisines: place.cuisines ?? [],
      price: Math.min(4, Math.max(1, place.priceLevel ?? 2)),
      address: place.address?.trim() || null,
      lat: place.lat,
      lng: place.lng,
      googlePlaceId: place.googlePlaceId?.trim() || null,
      mapsUrl: place.mapsUrl?.trim() || null,
      reserveUrl: null,
      tags: [],
      status: "wishlist",
      notes: null,
    })
  );
  await adapter.addNomination(sessionId, profile.id, created.id);
  revalidatePath("/vote");
  revalidatePath("/restaurants");
}

export async function removeNominationAction(sessionId: string, brandId: string): Promise<void> {
  const profile = await requireProfile();
  await (await db()).removeNomination(sessionId, profile.id, brandId);
  revalidatePath("/vote");
}

/** Close nominations and put the nominated places up for a normal vote. */
export async function openVotingAction(sessionId: string): Promise<void> {
  await requireProfile();
  const adapter = await db();
  const session = await adapter.getVoteSession(sessionId);
  if (!session || session.status !== "nominating") return;
  const nominations = await adapter.listNominations(sessionId);
  const candidateIds = nominationCandidates(nominations, NOMINATIONS_PER_PROFILE).map(
    (c) => c.brandId
  );
  if (candidateIds.length < 2) return;
  await adapter.openVoting(sessionId, candidateIds.slice(0, 8));
  revalidatePath("/vote");
}

export type NominationSpin = { winnerId: string; segmentIds: string[] } | null;

/**
 * "Let the wheel decide": weighted-pick a winner among the nominations
 * (favorites and recency still matter, via the same weights as the wheel)
 * and close the round. Returns the winner + segment ids so the client can
 * play the spin animation, or null if the round was already over.
 */
export async function spinNominationsAction(sessionId: string): Promise<NominationSpin> {
  await requireProfile();
  const adapter = await db();
  const session = await adapter.getVoteSession(sessionId);
  if (!session || session.status !== "nominating") return null;
  const nominations = await adapter.listNominations(sessionId);
  const ids = nominationCandidates(nominations, NOMINATIONS_PER_PROFILE).map((c) => c.brandId);
  if (ids.length === 0) return null;

  const [restaurants, recentVisits] = await Promise.all([
    adapter.listRestaurants(),
    adapter.listRecentVisits(50),
  ]);
  const byId = new Map(restaurants.map((r) => [r.id, r]));
  const pool = ids.map((id) => byId.get(id)).filter((r): r is RestaurantFull => !!r);
  if (pool.length === 0) return null;
  const cuisineRecency = buildCuisineRecency(
    recentVisits,
    new Map(restaurants.map((r) => [r.id, r.cuisines]))
  );
  const weighted = pool.map((r) => weighCandidate(r, DEFAULT_FILTERS, cuisineRecency));
  const pick = pickWeighted(weighted) ?? weighted[0];
  if (!(await adapter.closeVoteSession(sessionId, pick.restaurant.id))) return null;
  // no revalidatePath here: it would swap the page to the winner view before
  // the wheel animation plays — the client refreshes once the spin lands
  return { winnerId: pick.restaurant.id, segmentIds: pool.map((r) => r.id) };
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

  const adapter = await db();
  const prev = await adapter.getSettings(); // preserve cuisineOverrides etc.
  let settings: Settings;
  if (zip) {
    const hit = await zipToCoords(zip);
    if (!hit) {
      return { ok: false, message: `Couldn't find ZIP code "${zip}" — double-check it?` };
    }
    settings = { ...prev, homeLabel: `${hit.label} (${zip})`, homeLat: hit.lat, homeLng: hit.lng, radiusMeters };
  } else if (manualLat !== null && manualLng !== null) {
    settings = {
      ...prev,
      homeLabel: String(formData.get("homeLabel") ?? "").trim() || "Home",
      homeLat: manualLat,
      homeLng: manualLng,
      radiusMeters,
    };
  } else {
    return { ok: false, message: "Enter a ZIP code (or coordinates under Advanced)." };
  }

  await adapter.saveSettings(settings);
  revalidatePath("/settings");
  revalidatePath("/discover");
  return { ok: true, message: `Home set to ${settings.homeLabel} ✓` };
}
