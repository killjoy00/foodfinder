import { randomUUID } from "crypto";
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

type CatalogRestaurant = Omit<Restaurant, "status" | "notes">;
type HouseholdRow = { id: string; name: string; nameKey: string; passwordHash: string };
type GroupRestaurant = {
  householdId: string;
  restaurantId: string;
  status: "active" | "wishlist";
  notes: string | null;
  createdAt: string;
};

type Store = {
  households: HouseholdRow[];
  profiles: (Profile & { householdId: string })[];
  restaurants: CatalogRestaurant[];
  groupRestaurants: GroupRestaurant[];
  ratings: { restaurantId: string; profileId: string; score: number }[];
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

  const gr = (restaurantId: string, status: "active" | "wishlist"): GroupRestaurant => ({
    householdId: DEMO_HID,
    restaurantId,
    status,
    notes: null,
    createdAt: daysAgo(200),
  });
  const groupRestaurants: GroupRestaurant[] = [
    ...["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9"].map((id) => gr(id, "active")),
    gr("r10", "wishlist"),
    gr("r11", "wishlist"),
  ];

  const ratings = [
    { restaurantId: "r1", profileId: "p1", score: 8 },
    { restaurantId: "r1", profileId: "p2", score: 9 },
    { restaurantId: "r1", profileId: "p3", score: 10 },
    { restaurantId: "r1", profileId: "p4", score: 7 },
    { restaurantId: "r2", profileId: "p1", score: 9 },
    { restaurantId: "r2", profileId: "p2", score: 7 },
    { restaurantId: "r2", profileId: "p3", score: 6 },
    { restaurantId: "r3", profileId: "p1", score: 6 },
    { restaurantId: "r3", profileId: "p2", score: 7 },
    { restaurantId: "r3", profileId: "p3", score: 8 },
    { restaurantId: "r3", profileId: "p4", score: 9 },
    { restaurantId: "r4", profileId: "p1", score: 9 },
    { restaurantId: "r4", profileId: "p2", score: 8 },
    { restaurantId: "r5", profileId: "p3", score: 10 },
    { restaurantId: "r5", profileId: "p4", score: 10 },
    { restaurantId: "r5", profileId: "p1", score: 5 },
    { restaurantId: "r6", profileId: "p1", score: 8 },
    { restaurantId: "r6", profileId: "p2", score: 8 },
    { restaurantId: "r7", profileId: "p1", score: 10 },
    { restaurantId: "r7", profileId: "p2", score: 9 },
    { restaurantId: "r8", profileId: "p2", score: 9 },
    { restaurantId: "r8", profileId: "p1", score: 7 },
    { restaurantId: "r9", profileId: "p3", score: 8 },
    { restaurantId: "r9", profileId: "p4", score: 8 },
  ];

  const mkVisit = (id: string, restaurantId: string, ago: number, mode: VisitMode = "dine_in") => ({
    id,
    householdId: DEMO_HID,
    restaurantId,
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
}

export class MemoryAdapter implements DataAdapter {
  constructor(private hid: string) {}

  private enrich(c: CatalogRestaurant, link: GroupRestaurant): RestaurantFull {
    const s = store();
    const ratings: Record<string, number> = {};
    const memberIds = new Set(s.profiles.filter((p) => p.householdId === this.hid).map((p) => p.id));
    for (const r of s.ratings) {
      if (r.restaurantId === c.id && memberIds.has(r.profileId)) ratings[r.profileId] = r.score;
    }
    const visits = s.visits
      .filter((v) => v.restaurantId === c.id && v.householdId === this.hid)
      .sort((a, b) => b.date.localeCompare(a.date));
    return {
      ...c,
      status: link.status,
      notes: link.notes,
      ratings,
      lastVisitAt: visits[0]?.date ?? null,
      visitCount: visits.length,
    };
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

  private myLinks(): GroupRestaurant[] {
    return store().groupRestaurants.filter((g) => g.householdId === this.hid);
  }

  async listRestaurants(): Promise<RestaurantFull[]> {
    const s = store();
    const byId = new Map(s.restaurants.map((r) => [r.id, r]));
    return this.myLinks()
      .map((link) => {
        const c = byId.get(link.restaurantId);
        return c ? this.enrich(c, link) : null;
      })
      .filter((r): r is RestaurantFull => r !== null);
  }

  async getRestaurant(id: string): Promise<RestaurantFull | null> {
    const link = this.myLinks().find((g) => g.restaurantId === id);
    const c = store().restaurants.find((r) => r.id === id);
    return link && c ? this.enrich(c, link) : null;
  }

  /** Find an existing catalog row to reuse, or null. */
  private findCatalog(data: NewRestaurant): CatalogRestaurant | null {
    const s = store();
    if (data.googlePlaceId) {
      const byPid = s.restaurants.find((r) => r.googlePlaceId === data.googlePlaceId);
      if (byPid) return byPid;
    }
    const key = data.name.trim().toLowerCase();
    return s.restaurants.find((r) => r.name.trim().toLowerCase() === key) ?? null;
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
    const existing = s.groupRestaurants.find(
      (g) => g.householdId === this.hid && g.restaurantId === catalog!.id
    );
    if (existing) {
      existing.status = data.status;
      if (data.notes) existing.notes = data.notes;
    } else {
      s.groupRestaurants.push({
        householdId: this.hid,
        restaurantId: catalog.id,
        status: data.status,
        notes: data.notes,
        createdAt: new Date().toISOString(),
      });
    }
    return { ...catalog, status: data.status, notes: data.notes };
  }

  async updateRestaurant(id: string, data: Partial<NewRestaurant>): Promise<void> {
    const s = store();
    const catalog = s.restaurants.find((r) => r.id === id);
    if (catalog) {
      for (const k of [
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
      ] as const) {
        if (data[k] !== undefined) (catalog as Record<string, unknown>)[k] = data[k];
      }
    }
    const link = s.groupRestaurants.find(
      (g) => g.householdId === this.hid && g.restaurantId === id
    );
    if (link) {
      if (data.status !== undefined) link.status = data.status;
      if (data.notes !== undefined) link.notes = data.notes;
    }
  }

  async deleteRestaurant(id: string): Promise<void> {
    const s = store();
    s.groupRestaurants = s.groupRestaurants.filter(
      (g) => !(g.householdId === this.hid && g.restaurantId === id)
    );
    s.visits = s.visits.filter((v) => !(v.restaurantId === id && v.householdId === this.hid));
    const memberIds = new Set(s.profiles.filter((p) => p.householdId === this.hid).map((p) => p.id));
    s.ratings = s.ratings.filter((r) => !(r.restaurantId === id && memberIds.has(r.profileId)));
  }

  async clearWishlist(): Promise<number> {
    const s = store();
    const ids = new Set(
      s.groupRestaurants
        .filter((g) => g.householdId === this.hid && g.status === "wishlist")
        .map((g) => g.restaurantId)
    );
    if (ids.size === 0) return 0;
    s.groupRestaurants = s.groupRestaurants.filter(
      (g) => !(g.householdId === this.hid && g.status === "wishlist")
    );
    s.visits = s.visits.filter((v) => !(v.householdId === this.hid && ids.has(v.restaurantId)));
    const memberIds = new Set(s.profiles.filter((p) => p.householdId === this.hid).map((p) => p.id));
    s.ratings = s.ratings.filter((r) => !(ids.has(r.restaurantId) && memberIds.has(r.profileId)));
    return ids.size;
  }

  async mergeRestaurants(survivorId: string, loserId: string): Promise<void> {
    const s = store();
    if (survivorId === loserId) return;
    const survivor = s.restaurants.find((r) => r.id === survivorId);
    const loser = s.restaurants.find((r) => r.id === loserId);
    if (!survivor || !loser) return;

    survivor.cuisines = [...new Set([...survivor.cuisines, ...loser.cuisines])];
    survivor.tags = [...new Set([...survivor.tags, ...loser.tags])];
    survivor.address ??= loser.address;
    survivor.lat ??= loser.lat;
    survivor.lng ??= loser.lng;
    survivor.googlePlaceId ??= loser.googlePlaceId;
    survivor.mapsUrl ??= loser.mapsUrl;
    survivor.reserveUrl ??= loser.reserveUrl;

    // repoint group links (one per household; merge status/notes keeping survivor's)
    for (const link of s.groupRestaurants.filter((g) => g.restaurantId === loserId)) {
      const surv = s.groupRestaurants.find(
        (g) => g.householdId === link.householdId && g.restaurantId === survivorId
      );
      if (surv) {
        if (link.status === "active") surv.status = "active";
        surv.notes ??= link.notes;
      } else {
        link.restaurantId = survivorId;
      }
    }
    s.groupRestaurants = s.groupRestaurants.filter((g) => g.restaurantId !== loserId);

    for (const v of s.visits) if (v.restaurantId === loserId) v.restaurantId = survivorId;

    for (const rating of s.ratings.filter((r) => r.restaurantId === loserId)) {
      const exists = s.ratings.some(
        (x) => x.restaurantId === survivorId && x.profileId === rating.profileId
      );
      if (!exists) rating.restaurantId = survivorId;
    }
    s.ratings = s.ratings.filter((r) => r.restaurantId !== loserId);
    s.restaurants = s.restaurants.filter((r) => r.id !== loserId);
  }

  async setRating(restaurantId: string, profileId: string, score: number): Promise<void> {
    const s = store();
    const member = s.profiles.some((p) => p.id === profileId && p.householdId === this.hid);
    if (!member) return;
    const existing = s.ratings.find(
      (r) => r.restaurantId === restaurantId && r.profileId === profileId
    );
    if (existing) existing.score = score;
    else s.ratings.push({ restaurantId, profileId, score });
  }

  async addVisit(restaurantId: string, date: string, mode: VisitMode, note: string | null): Promise<void> {
    store().visits.push({ id: randomUUID(), householdId: this.hid, restaurantId, date, mode, note });
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
