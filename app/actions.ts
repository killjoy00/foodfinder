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
  RecommendationGroup,
  RecommendationPick,
  addDiscoveryToWishlist,
  addRecommendationToWishlist,
  castVote,
  closeVote,
  ensureCoords,
  fetchRecommendationGroups,
  importTakeout,
  logVisit,
  saveHomeLocation,
  startQuickVote,
  trackRestaurantWithGeocode,
} from "@/lib/services";
import { runDiscoverySweep, SweepResult } from "@/lib/sweep";
import { TakeoutItem } from "@/lib/takeout";
import { RestaurantStatus, VisitMode } from "@/lib/types";

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
  await trackRestaurantWithGeocode(await db(), restaurantId, status);
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
  await logVisit(await db(), restaurantId, mode, note);
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
  await startQuickVote(await db(), count);
  revalidatePath("/vote");
}

export async function castVoteAction(
  sessionId: string,
  pickId: string | null,
  vetoId: string | null,
  deferred: boolean = false
): Promise<void> {
  const profile = await requireProfile();
  await castVote(await db(), profile.id, sessionId, pickId, vetoId, deferred);
  revalidatePath("/vote");
}

export async function closeVoteAction(sessionId: string): Promise<void> {
  await requireProfile();
  await closeVote(await db(), sessionId);
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
  await addDiscoveryToWishlist(await db(), placeId);
  revalidatePath("/discover");
  revalidatePath("/restaurants");
}

export async function runSweepAction(): Promise<SweepResult> {
  await requireProfile();
  const result = await runDiscoverySweep(await db());
  revalidatePath("/discover");
  return result;
}

export async function fetchRecommendationsAction(radiusMiles?: number): Promise<
  { ok: true; groups: RecommendationGroup[] } | { ok: false; error: string }
> {
  await requireProfile();
  return fetchRecommendationGroups(await db(), radiusMiles);
}

export async function addRecommendationToWishlistAction(place: RecommendationPick): Promise<void> {
  await requireProfile();
  await addRecommendationToWishlist(await db(), place);
  revalidatePath("/restaurants");
}

// ---------- import ----------

export async function importTakeoutAction(
  items: TakeoutItem[]
): Promise<{ imported: number; skipped: number }> {
  const profile = await requireProfile();
  const result = await importTakeout(await db(), profile.id, items);
  revalidatePath("/restaurants");
  return result;
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
  const result = await saveHomeLocation(await db(), {
    zip: String(formData.get("zip") ?? ""),
    homeLabel: String(formData.get("homeLabel") ?? ""),
    homeLat: num("homeLat"),
    homeLng: num("homeLng"),
    radiusMiles: num("radiusMiles"),
  });
  if (result.ok) {
    revalidatePath("/settings");
    revalidatePath("/discover");
  }
  return result;
}
