import { SupabaseClient, createClient } from "@supabase/supabase-js";
import {
  DEFAULT_SETTINGS,
  Discovery,
  Household,
  Profile,
  Restaurant,
  RestaurantFull,
  Settings,
  Visit,
  VisitMode,
  Vote,
  VoteSession,
} from "../types";
import { DataAdapter, DiscoveryInput, HouseholdAuth, HouseholdRegistry, NewRestaurant } from "./adapter";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

type Catalog = Omit<Restaurant, "status" | "notes">;

function rowToCatalog(row: Row): Catalog {
  return {
    id: row.id,
    name: row.name,
    cuisines: row.cuisines ?? [],
    price: row.price ?? 2,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    googlePlaceId: row.google_place_id,
    mapsUrl: row.maps_url,
    reserveUrl: row.reserve_url,
    tags: row.tags ?? [],
    createdAt: row.created_at,
  };
}

const CATALOG_KEYS: (keyof NewRestaurant)[] = [
  "name",
  "cuisines",
  "price",
  "address",
  "lat",
  "lng",
  "googlePlaceId",
  "mapsUrl",
  "reserveUrl",
  "tags",
];

function catalogToRow(data: Partial<NewRestaurant>): Row {
  const row: Row = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.cuisines !== undefined) row.cuisines = data.cuisines;
  if (data.price !== undefined) row.price = data.price;
  if (data.address !== undefined) row.address = data.address;
  if (data.lat !== undefined) row.lat = data.lat;
  if (data.lng !== undefined) row.lng = data.lng;
  if (data.googlePlaceId !== undefined) row.google_place_id = data.googlePlaceId;
  if (data.mapsUrl !== undefined) row.maps_url = data.mapsUrl;
  if (data.reserveUrl !== undefined) row.reserve_url = data.reserveUrl;
  if (data.tags !== undefined) row.tags = data.tags;
  return row;
}

function hasCatalogChange(data: Partial<NewRestaurant>): boolean {
  return CATALOG_KEYS.some((k) => data[k] !== undefined);
}

function rowToVisit(row: Row): Visit {
  return { id: row.id, restaurantId: row.restaurant_id, date: row.date, mode: row.mode, note: row.note };
}

function rowToSession(row: Row): VoteSession {
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    candidateIds: row.candidate_ids ?? [],
    winnerId: row.winner_id,
  };
}

function makeClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: false } });
}

async function unwrap<T>(
  p: PromiseLike<{ data: T; error: PostgrestErrorLike | null }>
): Promise<T> {
  const { data, error } = await p;
  if (error) {
    const parts = [error.message, error.details, error.hint, error.code && `(${error.code})`].filter(
      Boolean
    );
    throw new Error(`Database error: ${parts.join(" | ") || "unknown"}`);
  }
  return data;
}

type PostgrestErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

/** PostgREST puts every value in the URL, so a big IN(...) can overflow it. */
const IN_CHUNK = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export class SupabaseRegistry implements HouseholdRegistry {
  private client: SupabaseClient;
  constructor(url: string, key: string) {
    this.client = makeClient(url, key);
  }
  async createHousehold(name: string, passwordHash: string): Promise<Household> {
    const row = await unwrap(
      this.client
        .from("households")
        .insert({ name, name_key: name.trim().toLowerCase(), password_hash: passwordHash })
        .select()
        .single()
    );
    return { id: row.id, name: row.name };
  }
  async findHouseholdByName(name: string): Promise<HouseholdAuth | null> {
    const row = await unwrap(
      this.client
        .from("households")
        .select("id, name, password_hash")
        .eq("name_key", name.trim().toLowerCase())
        .maybeSingle()
    );
    return row ? { id: row.id, name: row.name, passwordHash: row.password_hash } : null;
  }
  async getHousehold(id: string): Promise<Household | null> {
    const row = await unwrap(
      this.client.from("households").select("id, name").eq("id", id).maybeSingle()
    );
    return row ? { id: row.id, name: row.name } : null;
  }
  async listHouseholds(): Promise<Household[]> {
    const rows = await unwrap(this.client.from("households").select("id, name"));
    return (rows ?? []).map((r: Row) => ({ id: r.id, name: r.name }));
  }
}

export class SupabaseAdapter implements DataAdapter {
  private client: SupabaseClient;
  constructor(url: string, key: string, private hid: string) {
    this.client = makeClient(url, key);
  }
  private unwrap = unwrap;

  private async memberIds(): Promise<string[]> {
    const rows = await unwrap(this.client.from("profiles").select("id").eq("household_id", this.hid));
    return (rows ?? []).map((r: Row) => r.id);
  }

  async listProfiles(): Promise<Profile[]> {
    const rows = await unwrap(
      this.client
        .from("profiles")
        .select("*")
        .eq("household_id", this.hid)
        .order("created_at", { ascending: true })
    );
    return (rows ?? []).map((r: Row) => ({
      id: r.id,
      name: r.name,
      emoji: r.emoji,
      color: r.color,
      doubleCredits: r.double_credits ?? 0,
    }));
  }

  async createProfile(name: string, emoji: string, color: string): Promise<Profile> {
    const row = await unwrap(
      this.client
        .from("profiles")
        .insert({ household_id: this.hid, name, emoji, color })
        .select()
        .single()
    );
    return { id: row.id, name: row.name, emoji: row.emoji, color: row.color, doubleCredits: 0 };
  }

  async updateProfile(id: string, data: Partial<Omit<Profile, "id">>): Promise<void> {
    const row: Row = {};
    if (data.name !== undefined) row.name = data.name;
    if (data.emoji !== undefined) row.emoji = data.emoji;
    if (data.color !== undefined) row.color = data.color;
    if (data.doubleCredits !== undefined) row.double_credits = data.doubleCredits;
    await unwrap(this.client.from("profiles").update(row).eq("id", id).eq("household_id", this.hid));
  }

  async setDoubleCredits(profileId: string, credits: number): Promise<void> {
    await unwrap(
      this.client
        .from("profiles")
        .update({ double_credits: Math.max(0, credits) })
        .eq("id", profileId)
        .eq("household_id", this.hid)
    );
  }

  async deleteProfile(id: string): Promise<void> {
    await unwrap(this.client.from("profiles").delete().eq("id", id).eq("household_id", this.hid));
  }

  private async enrich(links: Row[]): Promise<RestaurantFull[]> {
    if (links.length === 0) return [];
    const ids = links.map((l) => l.restaurant_id);
    const members = await this.memberIds();

    // Fetch in chunks so a long restaurant list doesn't overflow the request URL.
    const catalogRows: Row[] = [];
    const ratingRows: Row[] = [];
    const visitRows: Row[] = [];
    for (const part of chunk(ids, IN_CHUNK)) {
      catalogRows.push(...((await unwrap(this.client.from("restaurants").select("*").in("id", part))) ?? []));
      visitRows.push(
        ...((await unwrap(
          this.client
            .from("visits")
            .select("restaurant_id, date")
            .eq("household_id", this.hid)
            .in("restaurant_id", part)
        )) ?? [])
      );
      if (members.length) {
        ratingRows.push(
          ...((await unwrap(
            this.client
              .from("ratings")
              .select("restaurant_id, profile_id, score")
              .in("restaurant_id", part)
              .in("profile_id", members)
          )) ?? [])
        );
      }
    }

    const catalogById = new Map((catalogRows ?? []).map((r: Row) => [r.id, rowToCatalog(r)]));
    const ratingsByR = new Map<string, Record<string, number>>();
    for (const row of (ratingRows ?? []) as Row[]) {
      const m = ratingsByR.get(row.restaurant_id) ?? {};
      m[row.profile_id] = row.score;
      ratingsByR.set(row.restaurant_id, m);
    }
    const lastVisit = new Map<string, string>();
    const visitCount = new Map<string, number>();
    for (const row of (visitRows ?? []) as Row[]) {
      visitCount.set(row.restaurant_id, (visitCount.get(row.restaurant_id) ?? 0) + 1);
      const prev = lastVisit.get(row.restaurant_id);
      if (!prev || row.date > prev) lastVisit.set(row.restaurant_id, row.date);
    }

    const out: RestaurantFull[] = [];
    for (const link of links) {
      const c = catalogById.get(link.restaurant_id);
      if (!c) continue;
      out.push({
        ...c,
        status: link.status,
        notes: link.notes,
        ratings: ratingsByR.get(link.restaurant_id) ?? {},
        lastVisitAt: lastVisit.get(link.restaurant_id) ?? null,
        visitCount: visitCount.get(link.restaurant_id) ?? 0,
      });
    }
    return out;
  }

  async listRestaurants(): Promise<RestaurantFull[]> {
    const links = await unwrap(
      this.client.from("group_restaurants").select("*").eq("household_id", this.hid)
    );
    const full = await this.enrich(links ?? []);
    return full.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getRestaurant(id: string): Promise<RestaurantFull | null> {
    const link = await unwrap(
      this.client
        .from("group_restaurants")
        .select("*")
        .eq("household_id", this.hid)
        .eq("restaurant_id", id)
        .maybeSingle()
    );
    if (!link) return null;
    const [full] = await this.enrich([link]);
    return full ?? null;
  }

  private async findCatalogId(data: NewRestaurant): Promise<string | null> {
    if (data.googlePlaceId) {
      const byPid = await unwrap(
        this.client.from("restaurants").select("id").eq("google_place_id", data.googlePlaceId).maybeSingle()
      );
      if (byPid) return byPid.id;
    }
    const byName = await unwrap(
      this.client.from("restaurants").select("id").ilike("name", data.name).limit(1).maybeSingle()
    );
    return byName?.id ?? null;
  }

  async createRestaurant(data: NewRestaurant): Promise<Restaurant> {
    let catalogId = await this.findCatalogId(data);
    let catalog: Catalog;
    if (catalogId) {
      const row = await unwrap(
        this.client.from("restaurants").select("*").eq("id", catalogId).single()
      );
      catalog = rowToCatalog(row);
    } else {
      const row = await unwrap(
        this.client.from("restaurants").insert(catalogToRow(data)).select().single()
      );
      catalog = rowToCatalog(row);
      catalogId = catalog.id;
    }
    await unwrap(
      this.client.from("group_restaurants").upsert(
        { household_id: this.hid, restaurant_id: catalogId, status: data.status, notes: data.notes },
        { onConflict: "household_id,restaurant_id" }
      )
    );
    return { ...catalog, status: data.status, notes: data.notes };
  }

  async updateRestaurant(id: string, data: Partial<NewRestaurant>): Promise<void> {
    if (hasCatalogChange(data)) {
      await unwrap(this.client.from("restaurants").update(catalogToRow(data)).eq("id", id));
    }
    if (data.status !== undefined || data.notes !== undefined) {
      const patch: Row = {};
      if (data.status !== undefined) patch.status = data.status;
      if (data.notes !== undefined) patch.notes = data.notes;
      await unwrap(
        this.client
          .from("group_restaurants")
          .update(patch)
          .eq("household_id", this.hid)
          .eq("restaurant_id", id)
      );
    }
  }

  async deleteRestaurant(id: string): Promise<void> {
    await unwrap(
      this.client
        .from("group_restaurants")
        .delete()
        .eq("household_id", this.hid)
        .eq("restaurant_id", id)
    );
    await unwrap(
      this.client.from("visits").delete().eq("household_id", this.hid).eq("restaurant_id", id)
    );
    const members = await this.memberIds();
    if (members.length) {
      await unwrap(
        this.client.from("ratings").delete().eq("restaurant_id", id).in("profile_id", members)
      );
    }
  }

  async listCatalog(): Promise<import("./adapter").CatalogEntry[]> {
    const [catalog, links] = await Promise.all([
      unwrap(
        this.client
          .from("restaurants")
          .select("id, name, cuisines, price, address, lat, lng, maps_url")
          .order("name", { ascending: true })
          .limit(5000)
      ),
      unwrap(
        this.client
          .from("group_restaurants")
          .select("restaurant_id, status")
          .eq("household_id", this.hid)
      ),
    ]);
    const linkByR = new Map((links ?? []).map((l: Row) => [l.restaurant_id, l.status]));
    return (catalog ?? []).map((c: Row) => ({
      id: c.id,
      name: c.name,
      cuisines: c.cuisines ?? [],
      price: c.price ?? 2,
      address: c.address,
      lat: c.lat,
      lng: c.lng,
      mapsUrl: c.maps_url,
      tracked: linkByR.has(c.id),
      trackedStatus: linkByR.get(c.id) ?? null,
    }));
  }

  async addCatalogEntries(entries: import("./adapter").CatalogInput[]): Promise<number> {
    if (entries.length === 0) return 0;
    const toRow = (e: import("./adapter").CatalogInput) => ({
      name: e.name,
      cuisines: e.cuisines,
      price: e.price,
      address: e.address,
      lat: e.lat,
      lng: e.lng,
      google_place_id: e.googlePlaceId,
      maps_url: e.mapsUrl,
    });
    let added = 0;

    // entries with a Google place id: upsert ignoring existing
    const withPid = entries.filter((e) => e.googlePlaceId);
    for (const part of chunk(withPid, 500)) {
      const inserted = await unwrap(
        this.client
          .from("restaurants")
          .upsert(part.map(toRow), { onConflict: "google_place_id", ignoreDuplicates: true })
          .select("id")
      );
      added += (inserted ?? []).length;
    }

    // entries without a place id: dedupe by name against the catalog + batch
    const withoutPid = entries.filter((e) => !e.googlePlaceId);
    if (withoutPid.length) {
      const existing = new Set<string>();
      const names = [...new Set(withoutPid.map((e) => e.name))];
      for (const part of chunk(names, 200)) {
        const rows = await unwrap(this.client.from("restaurants").select("name").in("name", part));
        for (const r of (rows ?? []) as Row[]) existing.add(r.name.toLowerCase());
      }
      const seen = new Set<string>();
      const fresh = withoutPid.filter((e) => {
        const k = e.name.trim().toLowerCase();
        if (existing.has(k) || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      for (const part of chunk(fresh, 500)) {
        const inserted = await unwrap(
          this.client.from("restaurants").insert(part.map(toRow)).select("id")
        );
        added += (inserted ?? []).length;
      }
    }
    return added;
  }

  async trackRestaurant(restaurantId: string, status: "active" | "wishlist"): Promise<void> {
    await unwrap(
      this.client
        .from("group_restaurants")
        .upsert(
          { household_id: this.hid, restaurant_id: restaurantId, status },
          { onConflict: "household_id,restaurant_id" }
        )
    );
  }

  async clearWishlist(): Promise<number> {
    const links = await unwrap(
      this.client
        .from("group_restaurants")
        .select("restaurant_id")
        .eq("household_id", this.hid)
        .eq("status", "wishlist")
    );
    const ids = (links ?? []).map((r: Row) => r.restaurant_id);
    if (ids.length === 0) return 0;
    await unwrap(
      this.client
        .from("group_restaurants")
        .delete()
        .eq("household_id", this.hid)
        .eq("status", "wishlist")
    );
    const members = await this.memberIds();
    for (const part of chunk(ids, IN_CHUNK)) {
      await unwrap(
        this.client.from("visits").delete().eq("household_id", this.hid).in("restaurant_id", part)
      );
      if (members.length) {
        await unwrap(
          this.client.from("ratings").delete().in("restaurant_id", part).in("profile_id", members)
        );
      }
    }
    return ids.length;
  }

  async mergeRestaurants(survivorId: string, loserId: string): Promise<void> {
    if (survivorId === loserId) return;
    const [survivor, loser] = await Promise.all([
      unwrap(this.client.from("restaurants").select("*").eq("id", survivorId).maybeSingle()),
      unwrap(this.client.from("restaurants").select("*").eq("id", loserId).maybeSingle()),
    ]);
    if (!survivor || !loser) return;

    if (!survivor.google_place_id && loser.google_place_id) {
      await unwrap(this.client.from("restaurants").update({ google_place_id: null }).eq("id", loserId));
    }
    await unwrap(
      this.client
        .from("restaurants")
        .update({
          cuisines: [...new Set([...(survivor.cuisines ?? []), ...(loser.cuisines ?? [])])],
          tags: [...new Set([...(survivor.tags ?? []), ...(loser.tags ?? [])])],
          address: survivor.address ?? loser.address,
          lat: survivor.lat ?? loser.lat,
          lng: survivor.lng ?? loser.lng,
          google_place_id: survivor.google_place_id ?? loser.google_place_id,
          maps_url: survivor.maps_url ?? loser.maps_url,
          reserve_url: survivor.reserve_url ?? loser.reserve_url,
        })
        .eq("id", survivorId)
    );

    // repoint group links for households that don't already track the survivor
    const survLinks = await unwrap(
      this.client.from("group_restaurants").select("household_id").eq("restaurant_id", survivorId)
    );
    const survHouseholds = (survLinks ?? []).map((r: Row) => r.household_id);
    let moveLinks = this.client
      .from("group_restaurants")
      .update({ restaurant_id: survivorId })
      .eq("restaurant_id", loserId);
    if (survHouseholds.length) moveLinks = moveLinks.not("household_id", "in", `(${survHouseholds.join(",")})`);
    await unwrap(moveLinks);

    await unwrap(
      this.client.from("visits").update({ restaurant_id: survivorId }).eq("restaurant_id", loserId)
    );

    const survRatings = await unwrap(
      this.client.from("ratings").select("profile_id").eq("restaurant_id", survivorId)
    );
    const ratedProfiles = (survRatings ?? []).map((r: Row) => r.profile_id);
    let moveRatings = this.client
      .from("ratings")
      .update({ restaurant_id: survivorId })
      .eq("restaurant_id", loserId);
    if (ratedProfiles.length) moveRatings = moveRatings.not("profile_id", "in", `(${ratedProfiles.join(",")})`);
    await unwrap(moveRatings);

    await unwrap(this.client.from("restaurants").delete().eq("id", loserId));
  }

  async setRating(restaurantId: string, profileId: string, score: number): Promise<void> {
    const members = await this.memberIds();
    if (!members.includes(profileId)) return;
    await unwrap(
      this.client.from("ratings").upsert(
        { restaurant_id: restaurantId, profile_id: profileId, score, updated_at: new Date().toISOString() },
        { onConflict: "restaurant_id,profile_id" }
      )
    );
  }

  async clearRating(restaurantId: string, profileId: string): Promise<void> {
    await unwrap(
      this.client
        .from("ratings")
        .delete()
        .eq("restaurant_id", restaurantId)
        .eq("profile_id", profileId)
    );
  }

  async addVisit(restaurantId: string, date: string, mode: VisitMode, note: string | null): Promise<void> {
    await unwrap(
      this.client
        .from("visits")
        .insert({ household_id: this.hid, restaurant_id: restaurantId, date, mode, note })
    );
  }

  async listRecentVisits(limit: number): Promise<Visit[]> {
    const rows = await unwrap(
      this.client
        .from("visits")
        .select("*")
        .eq("household_id", this.hid)
        .order("date", { ascending: false })
        .limit(limit)
    );
    return (rows ?? []).map(rowToVisit);
  }

  async listVisitsForRestaurant(restaurantId: string): Promise<Visit[]> {
    const rows = await unwrap(
      this.client
        .from("visits")
        .select("*")
        .eq("household_id", this.hid)
        .eq("restaurant_id", restaurantId)
        .order("date", { ascending: false })
    );
    return (rows ?? []).map(rowToVisit);
  }

  async createVoteSession(candidateIds: string[]): Promise<VoteSession> {
    await unwrap(
      this.client
        .from("vote_sessions")
        .update({ status: "closed" })
        .eq("household_id", this.hid)
        .eq("status", "open")
    );
    const row = await unwrap(
      this.client
        .from("vote_sessions")
        .insert({ household_id: this.hid, status: "open", candidate_ids: candidateIds })
        .select()
        .single()
    );
    return rowToSession(row);
  }

  async getOpenVoteSession(): Promise<VoteSession | null> {
    const row = await unwrap(
      this.client
        .from("vote_sessions")
        .select("*")
        .eq("household_id", this.hid)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    );
    return row ? rowToSession(row) : null;
  }

  async getLatestVoteSession(): Promise<VoteSession | null> {
    const row = await unwrap(
      this.client
        .from("vote_sessions")
        .select("*")
        .eq("household_id", this.hid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    );
    return row ? rowToSession(row) : null;
  }

  async getVoteSession(id: string): Promise<VoteSession | null> {
    const row = await unwrap(
      this.client
        .from("vote_sessions")
        .select("*")
        .eq("id", id)
        .eq("household_id", this.hid)
        .maybeSingle()
    );
    return row ? rowToSession(row) : null;
  }

  async listVotes(sessionId: string): Promise<Vote[]> {
    if (!(await this.getVoteSession(sessionId))) return [];
    const rows = await unwrap(this.client.from("votes").select("*").eq("session_id", sessionId));
    return (rows ?? []).map((r: Row) => ({
      sessionId: r.session_id,
      profileId: r.profile_id,
      pickId: r.pick_id,
      vetoId: r.veto_id,
      deferred: r.deferred ?? false,
    }));
  }

  async castVote(
    sessionId: string,
    profileId: string,
    pickId: string | null,
    vetoId: string | null,
    deferred: boolean
  ): Promise<void> {
    if (!(await this.getVoteSession(sessionId))) return;
    await unwrap(
      this.client.from("votes").upsert(
        { session_id: sessionId, profile_id: profileId, pick_id: pickId, veto_id: vetoId, deferred },
        { onConflict: "session_id,profile_id" }
      )
    );
  }

  async closeVoteSession(sessionId: string, winnerId: string | null): Promise<void> {
    await unwrap(
      this.client
        .from("vote_sessions")
        .update({ status: "closed", winner_id: winnerId })
        .eq("id", sessionId)
        .eq("household_id", this.hid)
    );
  }

  async listDiscoveries(): Promise<Discovery[]> {
    const rows = await unwrap(
      this.client
        .from("discoveries")
        .select("*")
        .eq("household_id", this.hid)
        .eq("dismissed", false)
        .order("found_at", { ascending: false })
    );
    return (rows ?? []).map((r: Row) => ({
      placeId: r.place_id,
      name: r.name,
      address: r.address,
      rating: r.rating,
      mapsUrl: r.maps_url,
      foundAt: r.found_at,
      dismissed: r.dismissed,
    }));
  }

  async upsertDiscoveries(items: DiscoveryInput[]): Promise<number> {
    if (items.length === 0) return 0;
    const rows = items.map((d) => ({
      household_id: this.hid,
      place_id: d.placeId,
      name: d.name,
      address: d.address,
      rating: d.rating,
      maps_url: d.mapsUrl,
    }));
    const inserted = await unwrap(
      this.client
        .from("discoveries")
        .upsert(rows, { onConflict: "household_id,place_id", ignoreDuplicates: true })
        .select("place_id")
    );
    return (inserted ?? []).length;
  }

  async dismissDiscovery(placeId: string): Promise<void> {
    await unwrap(
      this.client
        .from("discoveries")
        .update({ dismissed: true })
        .eq("household_id", this.hid)
        .eq("place_id", placeId)
    );
  }

  async listSeenPlaceIds(): Promise<string[]> {
    const rows = await unwrap(
      this.client.from("seen_places").select("place_id").eq("household_id", this.hid)
    );
    return (rows ?? []).map((r: Row) => r.place_id);
  }

  async markPlacesSeen(placeIds: string[]): Promise<void> {
    if (placeIds.length === 0) return;
    await unwrap(
      this.client
        .from("seen_places")
        .upsert(placeIds.map((place_id) => ({ household_id: this.hid, place_id })), {
          onConflict: "household_id,place_id",
          ignoreDuplicates: true,
        })
    );
  }

  async getSettings(): Promise<Settings> {
    const row = await unwrap(
      this.client.from("settings").select("value").eq("household_id", this.hid).maybeSingle()
    );
    return row?.value ? { ...DEFAULT_SETTINGS, ...row.value } : { ...DEFAULT_SETTINGS };
  }

  async saveSettings(settings: Settings): Promise<void> {
    await unwrap(
      this.client
        .from("settings")
        .upsert({ household_id: this.hid, value: settings }, { onConflict: "household_id" })
    );
  }
}
