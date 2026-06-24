import { SupabaseClient, createClient } from "@supabase/supabase-js";
import {
  DEFAULT_SETTINGS,
  Discovery,
  Household,
  Profile,
  Restaurant,
  RestaurantFull,
  RestaurantLocation,
  Settings,
  Visit,
  VisitMode,
  Vote,
  VoteSession,
} from "../types";
import { DataAdapter, DiscoveryInput, HouseholdAuth, HouseholdRegistry, NewRestaurant } from "./adapter";
import { brandKey, buildBrand } from "../brand";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

type Catalog = Omit<Restaurant, "status" | "notes">;

function catalogToLocation(c: Catalog): RestaurantLocation {
  return {
    id: c.id,
    name: c.name,
    address: c.address,
    lat: c.lat,
    lng: c.lng,
    googlePlaceId: c.googlePlaceId,
    mapsUrl: c.mapsUrl,
    reserveUrl: c.reserveUrl,
    price: c.price,
    cuisines: c.cuisines,
    tags: c.tags,
  };
}

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
  // visits are brand-level now; expose the brand id in restaurantId (the
  // app uses it only as an opaque grouping key)
  return { id: row.id, restaurantId: row.brand_id ?? row.restaurant_id, date: row.date, mode: row.mode, note: row.note };
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
  async setHouseholdPassword(id: string, passwordHash: string): Promise<void> {
    await unwrap(this.client.from("households").update({ password_hash: passwordHash }).eq("id", id));
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

  private async homeOrigin(): Promise<{ lat: number | null; lng: number | null } | null> {
    const s = await this.getSettings();
    if (s.homeLat === null || s.homeLng === null) return null;
    return { lat: s.homeLat, lng: s.homeLng };
  }

  /** Build brands (with their locations, ratings, pooled visits) for display. */
  private async enrichBrands(brandRows: Row[]): Promise<RestaurantFull[]> {
    if (brandRows.length === 0) return [];
    const brandIds = brandRows.map((b) => b.id);
    const members = await this.memberIds();

    // which catalog locations belong to each brand
    const linkRows: Row[] = [];
    for (const part of chunk(brandIds, IN_CHUNK)) {
      linkRows.push(
        ...((await unwrap(
          this.client
            .from("group_restaurants")
            .select("restaurant_id, brand_id")
            .eq("household_id", this.hid)
            .in("brand_id", part)
        )) ?? [])
      );
    }
    const restIds = [...new Set(linkRows.map((l) => l.restaurant_id))];
    const catalogById = new Map<string, Catalog>();
    for (const part of chunk(restIds, IN_CHUNK)) {
      const rows = (await unwrap(this.client.from("restaurants").select("*").in("id", part))) ?? [];
      for (const r of rows as Row[]) catalogById.set(r.id, rowToCatalog(r));
    }

    // brand-wide ratings
    const ratingRows: Row[] = [];
    if (members.length) {
      for (const part of chunk(brandIds, IN_CHUNK)) {
        ratingRows.push(
          ...((await unwrap(
            this.client
              .from("brand_ratings")
              .select("brand_id, profile_id, score")
              .in("brand_id", part)
              .in("profile_id", members)
          )) ?? [])
        );
      }
    }
    const ratingsByB = new Map<string, Record<string, number>>();
    for (const row of ratingRows as Row[]) {
      const m = ratingsByB.get(row.brand_id) ?? {};
      m[row.profile_id] = row.score;
      ratingsByB.set(row.brand_id, m);
    }

    // pooled visits per brand
    const visitRows: Row[] = [];
    for (const part of chunk(brandIds, IN_CHUNK)) {
      visitRows.push(
        ...((await unwrap(
          this.client.from("visits").select("brand_id, date").eq("household_id", this.hid).in("brand_id", part)
        )) ?? [])
      );
    }
    const lastVisit = new Map<string, string>();
    const visitCount = new Map<string, number>();
    for (const row of visitRows as Row[]) {
      if (!row.brand_id) continue;
      visitCount.set(row.brand_id, (visitCount.get(row.brand_id) ?? 0) + 1);
      const prev = lastVisit.get(row.brand_id);
      if (!prev || row.date > prev) lastVisit.set(row.brand_id, row.date);
    }

    const overrides = (await this.getSettings()).cuisineOverrides ?? {};
    const home = await this.homeOrigin();
    const locsByBrand = new Map<string, RestaurantLocation[]>();
    for (const link of linkRows) {
      const c = catalogById.get(link.restaurant_id);
      if (!c) continue;
      const arr = locsByBrand.get(link.brand_id) ?? [];
      arr.push(catalogToLocation(c));
      locsByBrand.set(link.brand_id, arr);
    }

    return brandRows
      .map((b) =>
        buildBrand({
          id: b.id,
          name: b.name,
          status: b.status,
          notes: b.notes,
          createdAt: b.created_at,
          locations: locsByBrand.get(b.id) ?? [],
          ratings: ratingsByB.get(b.id) ?? {},
          lastVisitAt: lastVisit.get(b.id) ?? null,
          visitCount: visitCount.get(b.id) ?? 0,
          home,
          cuisineOverride: overrides[b.id] ?? null,
        })
      )
      .filter((b) => b.locationCount > 0);
  }

  async listRestaurants(): Promise<RestaurantFull[]> {
    const brands = await unwrap(this.client.from("brands").select("*").eq("household_id", this.hid));
    const full = await this.enrichBrands(brands ?? []);
    return full.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getRestaurant(id: string): Promise<RestaurantFull | null> {
    const brand = await unwrap(
      this.client.from("brands").select("*").eq("household_id", this.hid).eq("id", id).maybeSingle()
    );
    if (!brand) return null;
    const [full] = await this.enrichBrands([brand]);
    return full ?? null;
  }

  /** Find or create the brand for a name within this household; returns its id. */
  private async ensureBrandId(
    name: string,
    status: "active" | "wishlist",
    notes: string | null
  ): Promise<string> {
    const key = brandKey(name);
    const existing = await unwrap(
      this.client
        .from("brands")
        .select("id")
        .eq("household_id", this.hid)
        .eq("brand_key", key)
        .limit(1)
        .maybeSingle()
    );
    if (existing) return existing.id;
    const row = (await unwrap(
      this.client
        .from("brands")
        .insert({ household_id: this.hid, brand_key: key, name, status, notes })
        .select("id")
        .single()
    )) as Row;
    return row.id;
  }

  // Reuse a catalog row only for the same Google place — never by name, so
  // distinct locations (and different-city namesakes) stay separate rows; the
  // family's brand is what groups them.
  private async findCatalogId(data: NewRestaurant): Promise<string | null> {
    if (!data.googlePlaceId) return null;
    const byPid = await unwrap(
      this.client.from("restaurants").select("id").eq("google_place_id", data.googlePlaceId).maybeSingle()
    );
    return byPid?.id ?? null;
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
    const brandId = await this.ensureBrandId(data.name, data.status, data.notes);
    const brandPatch: Row = { status: data.status };
    if (data.notes) brandPatch.notes = data.notes;
    await unwrap(this.client.from("brands").update(brandPatch).eq("id", brandId).eq("household_id", this.hid));
    await unwrap(
      this.client.from("group_restaurants").upsert(
        { household_id: this.hid, restaurant_id: catalogId, brand_id: brandId },
        { onConflict: "household_id,restaurant_id" }
      )
    );
    // id is the brand id so callers land on the brand entry
    return { ...catalog, id: brandId, status: data.status, notes: data.notes };
  }

  async updateRestaurant(id: string, data: Partial<NewRestaurant>): Promise<void> {
    // brand-level fields
    const brandPatch: Row = {};
    if (data.name !== undefined) brandPatch.name = data.name;
    if (data.status !== undefined) brandPatch.status = data.status;
    if (data.notes !== undefined) brandPatch.notes = data.notes;
    if (Object.keys(brandPatch).length) {
      await unwrap(this.client.from("brands").update(brandPatch).eq("id", id).eq("household_id", this.hid));
    }
    if (data.cuisines !== undefined) {
      try {
        const settings = await this.getSettings();
        const overrides = { ...(settings.cuisineOverrides ?? {}), [id]: data.cuisines };
        await this.saveSettings({ ...settings, cuisineOverrides: overrides });
      } catch {
        // a settings failure shouldn't break the core edit
      }
    }
    // catalog facts (address/coords/price/tags) only apply to a single-location brand
    const links = await unwrap(
      this.client.from("group_restaurants").select("restaurant_id").eq("household_id", this.hid).eq("brand_id", id)
    );
    if ((links ?? []).length === 1 && hasCatalogChange(data)) {
      const patch = catalogToRow(data);
      delete patch.cuisines; // cuisines are a per-family brand override, not a catalog edit
      if (Object.keys(patch).length) {
        await unwrap(this.client.from("restaurants").update(patch).eq("id", links![0].restaurant_id));
      }
    }
  }

  async deleteRestaurant(id: string): Promise<void> {
    await unwrap(this.client.from("visits").delete().eq("household_id", this.hid).eq("brand_id", id));
    await unwrap(this.client.from("brand_ratings").delete().eq("brand_id", id));
    await unwrap(this.client.from("group_restaurants").delete().eq("household_id", this.hid).eq("brand_id", id));
    await unwrap(this.client.from("brands").delete().eq("id", id).eq("household_id", this.hid));
  }

  /**
   * PostgREST caps a single response at ~1000 rows regardless of .limit(),
   * so the shared catalog (thousands of rows) has to be paged with .range().
   * Ordering by (name, id) keeps pagination stable across pages.
   */
  private async fetchAllCatalogRows(): Promise<Row[]> {
    const PAGE = 1000;
    const out: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      const rows = await unwrap(
        this.client
          .from("restaurants")
          .select("id, name, cuisines, price, address, lat, lng, maps_url")
          .order("name", { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1)
      );
      const batch = (rows ?? []) as Row[];
      out.push(...batch);
      if (batch.length < PAGE) break;
    }
    return out;
  }

  async listCatalog(): Promise<import("./adapter").CatalogEntry[]> {
    const [catalog, links, brands] = await Promise.all([
      this.fetchAllCatalogRows(),
      unwrap(
        this.client.from("group_restaurants").select("restaurant_id, brand_id").eq("household_id", this.hid)
      ),
      unwrap(this.client.from("brands").select("id, status").eq("household_id", this.hid)),
    ]);
    const statusByBrand = new Map((brands ?? []).map((b: Row) => [b.id, b.status]));
    const statusByR = new Map<string, "active" | "wishlist">();
    for (const l of (links ?? []) as Row[]) {
      const st = statusByBrand.get(l.brand_id);
      if (st) statusByR.set(l.restaurant_id, st);
    }
    return catalog.map((c: Row) => ({
      id: c.id,
      name: c.name,
      cuisines: c.cuisines ?? [],
      price: c.price ?? 2,
      address: c.address,
      lat: c.lat,
      lng: c.lng,
      mapsUrl: c.maps_url,
      tracked: statusByR.has(c.id),
      trackedStatus: statusByR.get(c.id) ?? null,
    }));
  }

  async getCatalogLocation(restaurantId: string): Promise<RestaurantLocation | null> {
    const row = await unwrap(
      this.client.from("restaurants").select("*").eq("id", restaurantId).maybeSingle()
    );
    return row ? catalogToLocation(rowToCatalog(row)) : null;
  }

  async setLocationCoords(restaurantId: string, lat: number, lng: number): Promise<void> {
    await unwrap(this.client.from("restaurants").update({ lat, lng }).eq("id", restaurantId));
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

  async trackRestaurant(restaurantId: string, status: "active" | "wishlist"): Promise<string> {
    const cat = await unwrap(
      this.client.from("restaurants").select("name").eq("id", restaurantId).maybeSingle()
    );
    if (!cat) return "";
    const brandId = await this.ensureBrandId(cat.name, status, null);
    await unwrap(this.client.from("brands").update({ status }).eq("id", brandId).eq("household_id", this.hid));
    await unwrap(
      this.client.from("group_restaurants").upsert(
        { household_id: this.hid, restaurant_id: restaurantId, brand_id: brandId },
        { onConflict: "household_id,restaurant_id" }
      )
    );
    return brandId;
  }

  async clearWishlist(): Promise<number> {
    const brands = await unwrap(
      this.client.from("brands").select("id").eq("household_id", this.hid).eq("status", "wishlist")
    );
    const ids = (brands ?? []).map((b: Row) => b.id);
    if (ids.length === 0) return 0;
    for (const part of chunk(ids, IN_CHUNK)) {
      await unwrap(this.client.from("visits").delete().eq("household_id", this.hid).in("brand_id", part));
      await unwrap(this.client.from("brand_ratings").delete().in("brand_id", part));
      await unwrap(this.client.from("group_restaurants").delete().eq("household_id", this.hid).in("brand_id", part));
      await unwrap(this.client.from("brands").delete().eq("household_id", this.hid).in("id", part));
    }
    return ids.length;
  }

  /** Merge brand `loserId` into `survivorId`; ratings keep the highest per person. */
  async mergeRestaurants(survivorId: string, loserId: string): Promise<void> {
    if (survivorId === loserId) return;
    const [survivor, loser] = await Promise.all([
      unwrap(this.client.from("brands").select("*").eq("id", survivorId).eq("household_id", this.hid).maybeSingle()),
      unwrap(this.client.from("brands").select("*").eq("id", loserId).eq("household_id", this.hid).maybeSingle()),
    ]);
    if (!survivor || !loser) return;

    await unwrap(
      this.client.from("group_restaurants").update({ brand_id: survivorId }).eq("household_id", this.hid).eq("brand_id", loserId)
    );
    await unwrap(
      this.client.from("visits").update({ brand_id: survivorId }).eq("household_id", this.hid).eq("brand_id", loserId)
    );

    const [survR, loseR] = await Promise.all([
      unwrap(this.client.from("brand_ratings").select("profile_id, score").eq("brand_id", survivorId)),
      unwrap(this.client.from("brand_ratings").select("profile_id, score").eq("brand_id", loserId)),
    ]);
    const survMap = new Map((survR ?? []).map((r: Row) => [r.profile_id, r.score as number]));
    const upserts = ((loseR ?? []) as Row[]).map((r) => {
      const cur = survMap.get(r.profile_id);
      return {
        brand_id: survivorId,
        profile_id: r.profile_id,
        score: cur === undefined ? r.score : Math.max(cur, r.score),
        updated_at: new Date().toISOString(),
      };
    });
    if (upserts.length) {
      await unwrap(this.client.from("brand_ratings").upsert(upserts, { onConflict: "brand_id,profile_id" }));
    }
    await unwrap(this.client.from("brand_ratings").delete().eq("brand_id", loserId));

    const patch: Row = {};
    if (survivor.status !== "active" && loser.status === "active") patch.status = "active";
    if (!survivor.notes && loser.notes) patch.notes = loser.notes;
    if (Object.keys(patch).length) await unwrap(this.client.from("brands").update(patch).eq("id", survivorId));
    await unwrap(this.client.from("brands").delete().eq("id", loserId).eq("household_id", this.hid));
  }

  async splitLocation(brandId: string, restaurantId: string): Promise<string> {
    const [link, parent, cat] = await Promise.all([
      unwrap(
        this.client
          .from("group_restaurants")
          .select("restaurant_id")
          .eq("household_id", this.hid)
          .eq("brand_id", brandId)
          .eq("restaurant_id", restaurantId)
          .maybeSingle()
      ),
      unwrap(this.client.from("brands").select("status").eq("id", brandId).eq("household_id", this.hid).maybeSingle()),
      unwrap(this.client.from("restaurants").select("name").eq("id", restaurantId).maybeSingle()),
    ]);
    if (!link || !parent || !cat) return brandId;
    const row = (await unwrap(
      this.client
        .from("brands")
        .insert({ household_id: this.hid, brand_key: brandKey(cat.name), name: cat.name, status: parent.status })
        .select("id")
        .single()
    )) as Row;
    await unwrap(
      this.client.from("group_restaurants").update({ brand_id: row.id }).eq("household_id", this.hid).eq("restaurant_id", restaurantId)
    );
    return row.id;
  }

  async setRating(brandId: string, profileId: string, score: number): Promise<void> {
    const members = await this.memberIds();
    if (!members.includes(profileId)) return;
    await unwrap(
      this.client.from("brand_ratings").upsert(
        { brand_id: brandId, profile_id: profileId, score, updated_at: new Date().toISOString() },
        { onConflict: "brand_id,profile_id" }
      )
    );
  }

  async clearRating(brandId: string, profileId: string): Promise<void> {
    const members = await this.memberIds();
    if (!members.includes(profileId)) return;
    await unwrap(
      this.client.from("brand_ratings").delete().eq("brand_id", brandId).eq("profile_id", profileId)
    );
  }

  async addVisit(brandId: string, date: string, mode: VisitMode, note: string | null): Promise<void> {
    await unwrap(
      this.client.from("visits").insert({ household_id: this.hid, brand_id: brandId, date, mode, note })
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

  async listVisitsForRestaurant(brandId: string): Promise<Visit[]> {
    const rows = await unwrap(
      this.client
        .from("visits")
        .select("*")
        .eq("household_id", this.hid)
        .eq("brand_id", brandId)
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
    const existing = new Set(await this.seenDiscoveryIds(items.map((d) => d.placeId)));
    const fresh = items.filter((d) => !existing.has(d.placeId));
    if (fresh.length === 0) return 0;
    await unwrap(
      this.client.from("discoveries").insert(
        fresh.map((d) => ({
          household_id: this.hid,
          place_id: d.placeId,
          name: d.name,
          address: d.address,
          rating: d.rating,
          maps_url: d.mapsUrl,
        }))
      )
    );
    return fresh.length;
  }

  private async seenDiscoveryIds(placeIds: string[]): Promise<string[]> {
    const out: string[] = [];
    for (const part of chunk(placeIds, IN_CHUNK)) {
      const rows = await unwrap(
        this.client
          .from("discoveries")
          .select("place_id")
          .eq("household_id", this.hid)
          .in("place_id", part)
      );
      out.push(...(rows ?? []).map((r: Row) => r.place_id));
    }
    return out;
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
    const existing = new Set<string>();
    for (const part of chunk(placeIds, IN_CHUNK)) {
      const rows = await unwrap(
        this.client.from("seen_places").select("place_id").eq("household_id", this.hid).in("place_id", part)
      );
      for (const r of (rows ?? []) as Row[]) existing.add(r.place_id);
    }
    const fresh = [...new Set(placeIds)].filter((p) => !existing.has(p));
    if (fresh.length === 0) return;
    await unwrap(
      this.client.from("seen_places").insert(fresh.map((place_id) => ({ household_id: this.hid, place_id })))
    );
  }

  async getSettings(): Promise<Settings> {
    // limit(1) so this never throws even if the settings table somehow has
    // duplicate rows for a household
    const rows = await unwrap(
      this.client.from("settings").select("value").eq("household_id", this.hid).limit(1)
    );
    const value = (rows ?? [])[0]?.value;
    return value ? { ...DEFAULT_SETTINGS, ...value } : { ...DEFAULT_SETTINGS };
  }

  async saveSettings(settings: Settings): Promise<void> {
    // Manual upsert (no ON CONFLICT) so this works regardless of whether the
    // settings table has a unique constraint on household_id.
    const rows = await unwrap(
      this.client.from("settings").select("household_id").eq("household_id", this.hid).limit(1)
    );
    if ((rows ?? []).length > 0) {
      await unwrap(this.client.from("settings").update({ value: settings }).eq("household_id", this.hid));
    } else {
      await unwrap(this.client.from("settings").insert({ household_id: this.hid, value: settings }));
    }
  }
}
