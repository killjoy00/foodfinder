import { randomUUID } from "crypto";
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

type CatalogRestaurant = Omit<Restaurant, "status" | "notes">;

function catalogToLocation(c: CatalogRestaurant): RestaurantLocation {
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
type HouseholdRow = { id: string; name: string; nameKey: string; passwordHash: string };
type BrandRow = {
  id: string;
  householdId: string;
  brandKey: string;
  name: string;
  status: "active" | "wishlist";
  notes: string | null;
  createdAt: string;
};
// links a catalog location to the brand the family files it under
type GroupRestaurant = {
  householdId: string;
  restaurantId: string;
  brandId: string;
  createdAt: string;
};

type Store = {
  households: HouseholdRow[];
  profiles: (Profile & { householdId: string })[];
  restaurants: CatalogRestaurant[];
  brands: BrandRow[];
  groupRestaurants: GroupRestaurant[];
  ratings: { brandId: string; profileId: string; score: number }[];
  // visits are brand-level; Visit.restaurantId holds the brand id
  visits: (Visit & { householdId: string })[];
  voteSessions: (VoteSession & { householdId: string })[];
  votes: Vote[];
  discoveries: (Discovery & { householdId: string })[];
  seenPlaces: { householdId: string; placeId: string }[];
  settings: { householdId: string; value: Settings }[];
};

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

const DEMO_HID = "h1";

function seedStore(): Store {
  const households: HouseholdRow[] = [
    { id: DEMO_HID, name: "Demo Family", nameKey: "demo family", passwordHash: "" },
  ];
  const profiles = [
    { id: "p1", householdId: DEMO_HID, name: "Mom", emoji: "🦊", color: "#f97316", doubleCredits: 0 },
    { id: "p2", householdId: DEMO_HID, name: "Dad", emoji: "🐻", color: "#3b82f6", doubleCredits: 0 },
    { id: "p3", householdId: DEMO_HID, name: "Riley", emoji: "🐸", color: "#22c55e", doubleCredits: 0 },
    { id: "p4", householdId: DEMO_HID, name: "Jordan", emoji: "🦄", color: "#a855f7", doubleCredits: 0 },
  ];

  const mk = (
    id: string,
    name: string,
    cuisines: string[],
    price: number,
    tags: string[]
  ): CatalogRestaurant => ({
    id,
    name,
    cuisines,
    price,
    address: "123 Demo St",
    lat: null,
    lng: null,
    googlePlaceId: null,
    mapsUrl: null,
    reserveUrl: null,
    tags,
    createdAt: daysAgo(200),
  });

  const restaurants: CatalogRestaurant[] = [
    mk("r1", "Taqueria Luna", ["Mexican"], 1, ["kid_friendly", "takeout"]),
    mk("r2", "Pasta Fresca", ["Italian"], 3, ["reservations", "date_night"]),
    mk("r3", "Golden Wok", ["Chinese"], 2, ["takeout", "kid_friendly"]),
    mk("r4", "Sakura Sushi", ["Japanese", "Sushi"], 3, ["reservations"]),
    mk("r5", "Burger Barn", ["American", "Burgers"], 1, ["kid_friendly", "patio", "takeout"]),
    mk("r6", "Thai Basil", ["Thai"], 2, ["takeout", "patio", "healthy"]),
    mk("r7", "Le Petit Bistro", ["French"], 4, ["reservations", "date_night"]),
    mk("r8", "Curry House", ["Indian"], 2, ["takeout"]),
    mk("r9", "El Mariachi", ["Mexican"], 2, ["patio", "kid_friendly"]),
    mk("r10", "Pho Saigon", ["Vietnamese"], 1, ["takeout", "kid_friendly", "healthy"]),
    mk("r11", "Smoke & Oak BBQ", ["BBQ", "American"], 3, ["patio"]),
  ];

  // each demo restaurant is its own brand (no chains in the sample data)
  const trackList: [string, "active" | "wishlist"][] = [
    ["r1", "active"], ["r2", "active"], ["r3", "active"], ["r4", "active"],
    ["r5", "active"], ["r6", "active"], ["r7", "active"], ["r8", "active"],
    ["r9", "active"], ["r10", "wishlist"], ["r11", "wishlist"],
  ];
  const brands: BrandRow[] = [];
  const groupRestaurants: GroupRestaurant[] = [];
  const brandIdOf: Record<string, string> = {};
  for (const [rid, status] of trackList) {
    const cat = restaurants.find((r) => r.id === rid)!;
    const id = `brand-${rid}`;
    brandIdOf[rid] = id;
    brands.push({
      id,
      householdId: DEMO_HID,
      brandKey: brandKey(cat.name),
      name: cat.name,
      status,
      notes: null,
      createdAt: daysAgo(200),
    });
    groupRestaurants.push({ householdId: DEMO_HID, restaurantId: rid, brandId: id, createdAt: daysAgo(200) });
  }

  const rawRatings = [
    { rid: "r1", profileId: "p1", score: 8 },
    { rid: "r1", profileId: "p2", score: 9 },
    { rid: "r1", profileId: "p3", score: 10 },
    { rid: "r1", profileId: "p4", score: 7 },
    { rid: "r2", profileId: "p1", score: 9 },
    { rid: "r2", profileId: "p2", score: 7 },
    { rid: "r2", profileId: "p3", score: 6 },
    { rid: "r3", profileId: "p1", score: 6 },
    { rid: "r3", profileId: "p2", score: 7 },
    { rid: "r3", profileId: "p3", score: 8 },
    { rid: "r3", profileId: "p4", score: 9 },
    { rid: "r4", profileId: "p1", score: 9 },
    { rid: "r4", profileId: "p2", score: 8 },
    { rid: "r5", profileId: "p3", score: 10 },
    { rid: "r5", profileId: "p4", score: 10 },
    { rid: "r5", profileId: "p1", score: 5 },
    { rid: "r6", profileId: "p1", score: 8 },
    { rid: "r6", profileId: "p2", score: 8 },
    { rid: "r7", profileId: "p1", score: 10 },
    { rid: "r7", profileId: "p2", score: 9 },
    { rid: "r8", profileId: "p2", score: 9 },
    { rid: "r8", profileId: "p1", score: 7 },
    { rid: "r9", profileId: "p3", score: 8 },
    { rid: "r9", profileId: "p4", score: 8 },
  ];
  const ratings = rawRatings.map((x) => ({ brandId: brandIdOf[x.rid], profileId: x.profileId, score: x.score }));

  const mkVisit = (id: string, rid: string, ago: number, mode: VisitMode = "dine_in") => ({
    id,
    householdId: DEMO_HID,
    restaurantId: brandIdOf[rid], // brand-level
    date: daysAgo(ago),
    mode,
    note: null,
  });
  const visits = [
    mkVisit("v1", "r1", 4),
    mkVisit("v2", "r9", 9),
    mkVisit("v3", "r3", 13, "takeout"),
    mkVisit("v4", "r5", 18),
    mkVisit("v5", "r2", 30),
    mkVisit("v6", "r4", 55),
    mkVisit("v7", "r6", 70, "takeout"),
    mkVisit("v8", "r7", 95),
    mkVisit("v9", "r8", 25, "takeout"),
  ];

  return {
    households,
    profiles,
    restaurants,
    brands,
    groupRestaurants,
    ratings,
    visits,
    voteSessions: [],
    votes: [],
    discoveries: [
      {
        householdId: DEMO_HID,
        placeId: "demo-disc-1",
        name: "Nonna's Wood-Fired Pizza",
        address: "456 New Spot Ave",
        rating: 4.7,
        mapsUrl: null,
        foundAt: daysAgo(2),
        dismissed: false,
      },
    ],
    seenPlaces: [],
    settings: [],
  };
}

const globalStore = globalThis as unknown as { __ffStore?: Store };

function store(): Store {
  if (!globalStore.__ffStore) globalStore.__ffStore = seedStore();
  return globalStore.__ffStore;
}

/** Drop the internal householdId before returning a row to callers. */
function stripHid<T extends { householdId: string }>(row: T): Omit<T, "householdId"> {
  const copy = { ...row } as Record<string, unknown>;
  delete copy.householdId;
  return copy as Omit<T, "householdId">;
}

export const DEMO_HOUSEHOLD_ID = DEMO_HID;

export class MemoryRegistry implements HouseholdRegistry {
  async createHousehold(name: string, passwordHash: string): Promise<Household> {
    const row: HouseholdRow = {
      id: randomUUID(),
      name,
      nameKey: name.trim().toLowerCase(),
      passwordHash,
    };
    store().households.push(row);
    return { id: row.id, name: row.name };
  }
  async findHouseholdByName(name: string): Promise<HouseholdAuth | null> {
    const row = store().households.find((h) => h.nameKey === name.trim().toLowerCase());
    return row ? { id: row.id, name: row.name, passwordHash: row.passwordHash } : null;
  }
  async getHousehold(id: string): Promise<Household | null> {
    const row = store().households.find((h) => h.id === id);
    return row ? { id: row.id, name: row.name } : null;
  }
  async listHouseholds(): Promise<Household[]> {
    return store().households.map((h) => ({ id: h.id, name: h.name }));
  }
  async setHouseholdPassword(id: string, passwordHash: string): Promise<void> {
    const h = store().households.find((x) => x.id === id);
    if (h) h.passwordHash = passwordHash;
  }
}

export class MemoryAdapter implements DataAdapter {
  constructor(private hid: string) {}

  private homeOrigin(): { lat: number | null; lng: number | null } | null {
    const v = store().settings.find((x) => x.householdId === this.hid)?.value;
    if (!v || v.homeLat === null || v.homeLng === null) return null;
    return { lat: v.homeLat, lng: v.homeLng };
  }

  private enrichBrand(brand: BrandRow): RestaurantFull {
    const s = store();
    const memberIds = new Set(s.profiles.filter((p) => p.householdId === this.hid).map((p) => p.id));
    const catById = new Map(s.restaurants.map((r) => [r.id, r]));
    const override = s.settings.find((x) => x.householdId === this.hid)?.value.cuisineOverrides?.[brand.id];
    const locations = s.groupRestaurants
      .filter((g) => g.householdId === this.hid && g.brandId === brand.id)
      .map((g) => catById.get(g.restaurantId))
      .filter((c): c is CatalogRestaurant => !!c)
      .map(catalogToLocation);
    const ratings: Record<string, number> = {};
    for (const r of s.ratings) {
      if (r.brandId === brand.id && memberIds.has(r.profileId)) ratings[r.profileId] = r.score;
    }
    const visits = s.visits
      .filter((v) => v.restaurantId === brand.id && v.householdId === this.hid)
      .sort((a, b) => b.date.localeCompare(a.date));
    return buildBrand({
      id: brand.id,
      name: brand.name,
      status: brand.status,
      notes: brand.notes,
      createdAt: brand.createdAt,
      locations,
      ratings,
      lastVisitAt: visits[0]?.date ?? null,
      visitCount: visits.length,
      home: this.homeOrigin(),
      cuisineOverride: override ?? null,
    });
  }

  async listProfiles(): Promise<Profile[]> {
    return store()
      .profiles.filter((p) => p.householdId === this.hid)
      .map(stripHid);
  }

  async createProfile(name: string, emoji: string, color: string): Promise<Profile> {
    const profile = { id: randomUUID(), householdId: this.hid, name, emoji, color, doubleCredits: 0 };
    store().profiles.push(profile);
    return stripHid(profile);
  }

  async updateProfile(id: string, data: Partial<Omit<Profile, "id">>): Promise<void> {
    const p = store().profiles.find((x) => x.id === id && x.householdId === this.hid);
    if (p) Object.assign(p, data);
  }

  async setDoubleCredits(profileId: string, credits: number): Promise<void> {
    const p = store().profiles.find((x) => x.id === profileId && x.householdId === this.hid);
    if (p) p.doubleCredits = Math.max(0, credits);
  }

  async deleteProfile(id: string): Promise<void> {
    const s = store();
    s.profiles = s.profiles.filter((p) => !(p.id === id && p.householdId === this.hid));
    s.ratings = s.ratings.filter((r) => r.profileId !== id);
  }

  private myBrands(): BrandRow[] {
    return store().brands.filter((b) => b.householdId === this.hid);
  }

  async listRestaurants(): Promise<RestaurantFull[]> {
    return this.myBrands().map((b) => this.enrichBrand(b));
  }

  async getRestaurant(id: string): Promise<RestaurantFull | null> {
    const brand = this.myBrands().find((b) => b.id === id);
    return brand ? this.enrichBrand(brand) : null;
  }

  /**
   * Reuse a catalog row only when it's the same Google place. We deliberately
   * do NOT dedup by name: two same-named places are distinct locations (the
   * family's brand groups them), and different-city namesakes stay separate.
   */
  private findCatalog(data: NewRestaurant): CatalogRestaurant | null {
    if (!data.googlePlaceId) return null;
    return store().restaurants.find((r) => r.googlePlaceId === data.googlePlaceId) ?? null;
  }

  /** The brand for this name (matched by brand key), creating one if needed. */
  private ensureBrand(name: string, status: "active" | "wishlist", notes: string | null): BrandRow {
    const s = store();
    const key = brandKey(name);
    let brand = s.brands.find((b) => b.householdId === this.hid && b.brandKey === key);
    if (!brand) {
      brand = {
        id: randomUUID(),
        householdId: this.hid,
        brandKey: key,
        name,
        status,
        notes,
        createdAt: new Date().toISOString(),
      };
      s.brands.push(brand);
    }
    return brand;
  }

  async createRestaurant(data: NewRestaurant): Promise<Restaurant> {
    const s = store();
    let catalog = this.findCatalog(data);
    if (!catalog) {
      catalog = {
        id: randomUUID(),
        name: data.name,
        cuisines: data.cuisines,
        price: data.price,
        address: data.address,
        lat: data.lat,
        lng: data.lng,
        googlePlaceId: data.googlePlaceId,
        mapsUrl: data.mapsUrl,
        reserveUrl: data.reserveUrl,
        tags: data.tags,
        createdAt: new Date().toISOString(),
      };
      s.restaurants.push(catalog);
    }
    const brand = this.ensureBrand(data.name, data.status, data.notes);
    brand.status = data.status;
    if (data.notes) brand.notes = data.notes;
    if (!s.groupRestaurants.some((g) => g.householdId === this.hid && g.restaurantId === catalog!.id)) {
      s.groupRestaurants.push({
        householdId: this.hid,
        restaurantId: catalog.id,
        brandId: brand.id,
        createdAt: new Date().toISOString(),
      });
    }
    // id is the brand id so callers land on the brand entry
    return { ...catalog, id: brand.id, status: brand.status, notes: brand.notes };
  }

  async updateRestaurant(id: string, data: Partial<NewRestaurant>): Promise<void> {
    const s = store();
    const brand = s.brands.find((b) => b.id === id && b.householdId === this.hid);
    if (!brand) return;
    if (data.name !== undefined) brand.name = data.name;
    if (data.status !== undefined) brand.status = data.status;
    if (data.notes !== undefined) brand.notes = data.notes;
    if (data.cuisines !== undefined) {
      const row = s.settings.find((x) => x.householdId === this.hid);
      const value = row?.value ?? { ...DEFAULT_SETTINGS };
      value.cuisineOverrides = { ...(value.cuisineOverrides ?? {}), [id]: data.cuisines };
      if (row) row.value = value;
      else s.settings.push({ householdId: this.hid, value });
    }
    // catalog facts only make sense to edit when the brand is a single location
    const links = s.groupRestaurants.filter((g) => g.householdId === this.hid && g.brandId === id);
    if (links.length === 1) {
      const catalog = s.restaurants.find((r) => r.id === links[0].restaurantId);
      if (catalog) {
        if (data.name !== undefined) catalog.name = data.name;
        // never reassign googlePlaceId on an edit (it's the location's identity)
        for (const k of ["price", "address", "lat", "lng", "mapsUrl", "reserveUrl", "tags"] as const) {
          if (data[k] !== undefined) (catalog as Record<string, unknown>)[k] = data[k];
        }
      }
    }
  }

  async deleteRestaurant(id: string): Promise<void> {
    const s = store();
    s.groupRestaurants = s.groupRestaurants.filter(
      (g) => !(g.householdId === this.hid && g.brandId === id)
    );
    s.visits = s.visits.filter((v) => !(v.restaurantId === id && v.householdId === this.hid));
    const memberIds = new Set(s.profiles.filter((p) => p.householdId === this.hid).map((p) => p.id));
    s.ratings = s.ratings.filter((r) => !(r.brandId === id && memberIds.has(r.profileId)));
    s.brands = s.brands.filter((b) => !(b.id === id && b.householdId === this.hid));
  }

  async listCatalog(): Promise<import("./adapter").CatalogEntry[]> {
    const s = store();
    const brandStatus = new Map(s.brands.filter((b) => b.householdId === this.hid).map((b) => [b.id, b.status]));
    const statusByR = new Map<string, "active" | "wishlist">();
    for (const g of s.groupRestaurants.filter((g) => g.householdId === this.hid)) {
      const st = brandStatus.get(g.brandId);
      if (st) statusByR.set(g.restaurantId, st);
    }
    return s.restaurants.map((c) => ({
      id: c.id,
      name: c.name,
      cuisines: c.cuisines,
      price: c.price,
      address: c.address,
      lat: c.lat,
      lng: c.lng,
      mapsUrl: c.mapsUrl,
      tracked: statusByR.has(c.id),
      trackedStatus: statusByR.get(c.id) ?? null,
    }));
  }

  async getCatalogLocation(restaurantId: string): Promise<RestaurantLocation | null> {
    const c = store().restaurants.find((r) => r.id === restaurantId);
    return c ? catalogToLocation(c) : null;
  }

  async setLocationCoords(restaurantId: string, lat: number, lng: number): Promise<void> {
    const c = store().restaurants.find((r) => r.id === restaurantId);
    if (c) {
      c.lat = lat;
      c.lng = lng;
    }
  }

  async addCatalogEntries(entries: import("./adapter").CatalogInput[]): Promise<number> {
    const s = store();
    let added = 0;
    for (const e of entries) {
      const dupe = s.restaurants.find(
        (c) =>
          (e.googlePlaceId && c.googlePlaceId === e.googlePlaceId) ||
          c.name.trim().toLowerCase() === e.name.trim().toLowerCase()
      );
      if (dupe) continue;
      s.restaurants.push({
        id: randomUUID(),
        name: e.name,
        cuisines: e.cuisines,
        price: e.price,
        address: e.address,
        lat: e.lat,
        lng: e.lng,
        googlePlaceId: e.googlePlaceId,
        mapsUrl: e.mapsUrl,
        reserveUrl: null,
        tags: [],
        createdAt: new Date().toISOString(),
      });
      added++;
    }
    return added;
  }

  async trackRestaurant(restaurantId: string, status: "active" | "wishlist"): Promise<string> {
    const s = store();
    const catalog = s.restaurants.find((r) => r.id === restaurantId);
    if (!catalog) return "";
    const brand = this.ensureBrand(catalog.name, status, null);
    brand.status = status;
    if (!s.groupRestaurants.some((g) => g.householdId === this.hid && g.restaurantId === restaurantId)) {
      s.groupRestaurants.push({
        householdId: this.hid,
        restaurantId,
        brandId: brand.id,
        createdAt: new Date().toISOString(),
      });
    }
    return brand.id;
  }

  async clearWishlist(): Promise<number> {
    const s = store();
    const brandIds = new Set(
      s.brands.filter((b) => b.householdId === this.hid && b.status === "wishlist").map((b) => b.id)
    );
    if (brandIds.size === 0) return 0;
    s.groupRestaurants = s.groupRestaurants.filter(
      (g) => !(g.householdId === this.hid && brandIds.has(g.brandId))
    );
    s.visits = s.visits.filter((v) => !(v.householdId === this.hid && brandIds.has(v.restaurantId)));
    const memberIds = new Set(s.profiles.filter((p) => p.householdId === this.hid).map((p) => p.id));
    s.ratings = s.ratings.filter((r) => !(brandIds.has(r.brandId) && memberIds.has(r.profileId)));
    s.brands = s.brands.filter((b) => !(b.householdId === this.hid && brandIds.has(b.id)));
    return brandIds.size;
  }

  /** Merge two of this household's brands; ratings keep the highest per person. */
  async mergeRestaurants(survivorId: string, loserId: string): Promise<void> {
    const s = store();
    if (survivorId === loserId) return;
    const survivor = s.brands.find((b) => b.id === survivorId && b.householdId === this.hid);
    const loser = s.brands.find((b) => b.id === loserId && b.householdId === this.hid);
    if (!survivor || !loser) return;

    for (const g of s.groupRestaurants) {
      if (g.householdId === this.hid && g.brandId === loserId) g.brandId = survivorId;
    }
    for (const lr of s.ratings.filter((r) => r.brandId === loserId)) {
      const sr = s.ratings.find((r) => r.brandId === survivorId && r.profileId === lr.profileId);
      if (sr) sr.score = Math.max(sr.score, lr.score);
      else s.ratings.push({ brandId: survivorId, profileId: lr.profileId, score: lr.score });
    }
    s.ratings = s.ratings.filter((r) => r.brandId !== loserId);
    for (const v of s.visits) if (v.restaurantId === loserId) v.restaurantId = survivorId;
    if (survivor.status !== "active" && loser.status === "active") survivor.status = "active";
    survivor.notes ??= loser.notes;
    s.brands = s.brands.filter((b) => b.id !== loserId);
  }

  /** Move one location out of a brand into its own new brand. */
  async splitLocation(brandId: string, restaurantId: string): Promise<string> {
    const s = store();
    const link = s.groupRestaurants.find(
      (g) => g.householdId === this.hid && g.brandId === brandId && g.restaurantId === restaurantId
    );
    const parent = s.brands.find((b) => b.id === brandId && b.householdId === this.hid);
    const catalog = s.restaurants.find((r) => r.id === restaurantId);
    if (!link || !parent || !catalog) return brandId;
    const newBrand: BrandRow = {
      id: randomUUID(),
      householdId: this.hid,
      brandKey: brandKey(catalog.name),
      name: catalog.name,
      status: parent.status,
      notes: null,
      createdAt: new Date().toISOString(),
    };
    s.brands.push(newBrand);
    link.brandId = newBrand.id;
    return newBrand.id;
  }

  async setRating(brandId: string, profileId: string, score: number): Promise<void> {
    const s = store();
    const member = s.profiles.some((p) => p.id === profileId && p.householdId === this.hid);
    if (!member) return;
    const existing = s.ratings.find((r) => r.brandId === brandId && r.profileId === profileId);
    if (existing) existing.score = score;
    else s.ratings.push({ brandId, profileId, score });
  }

  async clearRating(brandId: string, profileId: string): Promise<void> {
    const s = store();
    const member = s.profiles.some((p) => p.id === profileId && p.householdId === this.hid);
    if (!member) return;
    s.ratings = s.ratings.filter((r) => !(r.brandId === brandId && r.profileId === profileId));
  }

  async addVisit(brandId: string, date: string, mode: VisitMode, note: string | null): Promise<void> {
    store().visits.push({ id: randomUUID(), householdId: this.hid, restaurantId: brandId, date, mode, note });
  }

  async listRecentVisits(limit: number): Promise<Visit[]> {
    return store()
      .visits.filter((v) => v.householdId === this.hid)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit)
      .map(stripHid);
  }

  async listVisitsForRestaurant(restaurantId: string): Promise<Visit[]> {
    return store()
      .visits.filter((v) => v.restaurantId === restaurantId && v.householdId === this.hid)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(stripHid);
  }

  async createVoteSession(candidateIds: string[]): Promise<VoteSession> {
    const s = store();
    for (const session of s.voteSessions) {
      if (session.householdId === this.hid && session.status === "open") session.status = "closed";
    }
    const session = {
      id: randomUUID(),
      householdId: this.hid,
      createdAt: new Date().toISOString(),
      status: "open" as const,
      candidateIds,
      winnerId: null,
    };
    s.voteSessions.push(session);
    return stripHid(session);
  }

  private mySession(id: string): (VoteSession & { householdId: string }) | undefined {
    return store().voteSessions.find((v) => v.id === id && v.householdId === this.hid);
  }

  async getOpenVoteSession(): Promise<VoteSession | null> {
    const v = store().voteSessions.find((x) => x.householdId === this.hid && x.status === "open");
    if (!v) return null;
    return stripHid(v);
  }

  async getLatestVoteSession(): Promise<VoteSession | null> {
    const v = [...store().voteSessions]
      .filter((x) => x.householdId === this.hid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!v) return null;
    return stripHid(v);
  }

  async getVoteSession(id: string): Promise<VoteSession | null> {
    const v = this.mySession(id);
    if (!v) return null;
    return stripHid(v);
  }

  async listVotes(sessionId: string): Promise<Vote[]> {
    if (!this.mySession(sessionId)) return [];
    return store().votes.filter((v) => v.sessionId === sessionId);
  }

  async castVote(
    sessionId: string,
    profileId: string,
    pickId: string | null,
    vetoId: string | null,
    deferred: boolean
  ): Promise<void> {
    if (!this.mySession(sessionId)) return;
    const s = store();
    s.votes = s.votes.filter((v) => !(v.sessionId === sessionId && v.profileId === profileId));
    s.votes.push({ sessionId, profileId, pickId, vetoId, deferred });
  }

  async closeVoteSession(sessionId: string, winnerId: string | null): Promise<void> {
    const session = this.mySession(sessionId);
    if (session) {
      session.status = "closed";
      session.winnerId = winnerId;
    }
  }

  async listDiscoveries(): Promise<Discovery[]> {
    return store()
      .discoveries.filter((d) => d.householdId === this.hid && !d.dismissed)
      .sort((a, b) => b.foundAt.localeCompare(a.foundAt))
      .map(stripHid);
  }

  async upsertDiscoveries(items: DiscoveryInput[]): Promise<number> {
    const s = store();
    let added = 0;
    for (const item of items) {
      if (!s.discoveries.some((d) => d.householdId === this.hid && d.placeId === item.placeId)) {
        s.discoveries.push({
          ...item,
          householdId: this.hid,
          foundAt: new Date().toISOString(),
          dismissed: false,
        });
        added++;
      }
    }
    return added;
  }

  async dismissDiscovery(placeId: string): Promise<void> {
    const d = store().discoveries.find((x) => x.householdId === this.hid && x.placeId === placeId);
    if (d) d.dismissed = true;
  }

  async listSeenPlaceIds(): Promise<string[]> {
    return store()
      .seenPlaces.filter((s) => s.householdId === this.hid)
      .map((s) => s.placeId);
  }

  async markPlacesSeen(placeIds: string[]): Promise<void> {
    const s = store();
    for (const placeId of placeIds) {
      if (!s.seenPlaces.some((x) => x.householdId === this.hid && x.placeId === placeId)) {
        s.seenPlaces.push({ householdId: this.hid, placeId });
      }
    }
  }

  async getSettings(): Promise<Settings> {
    const row = store().settings.find((s) => s.householdId === this.hid);
    return row ? { ...row.value } : { ...DEFAULT_SETTINGS };
  }

  async saveSettings(settings: Settings): Promise<void> {
    const s = store();
    const row = s.settings.find((x) => x.householdId === this.hid);
    if (row) row.value = { ...settings };
    else s.settings.push({ householdId: this.hid, value: { ...settings } });
  }
}
