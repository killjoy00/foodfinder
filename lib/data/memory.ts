import { randomUUID } from "crypto";
import {
  DEFAULT_SETTINGS,
  Discovery,
  Profile,
  Restaurant,
  RestaurantFull,
  Settings,
  Visit,
  VisitMode,
  Vote,
  VoteSession,
} from "../types";
import { DataAdapter, DiscoveryInput, NewRestaurant } from "./adapter";

type Store = {
  profiles: Profile[];
  restaurants: Restaurant[];
  ratings: { restaurantId: string; profileId: string; score: number }[];
  visits: Visit[];
  voteSessions: VoteSession[];
  votes: Vote[];
  discoveries: Discovery[];
  seenPlaceIds: Set<string>;
  settings: Settings;
};

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

function seedStore(): Store {
  const profiles: Profile[] = [
    { id: "p1", name: "Mom", emoji: "🦊", color: "#f97316" },
    { id: "p2", name: "Dad", emoji: "🐻", color: "#3b82f6" },
    { id: "p3", name: "Riley", emoji: "🐸", color: "#22c55e" },
    { id: "p4", name: "Jordan", emoji: "🦄", color: "#a855f7" },
  ];

  const mk = (
    id: string,
    name: string,
    cuisines: string[],
    price: number,
    tags: string[],
    status: Restaurant["status"] = "active"
  ): Restaurant => ({
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
    status,
    notes: null,
    createdAt: daysAgo(200),
  });

  const restaurants: Restaurant[] = [
    mk("r1", "Taqueria Luna", ["Mexican"], 1, ["kid_friendly", "takeout"]),
    mk("r2", "Pasta Fresca", ["Italian"], 3, ["reservations", "date_night"]),
    mk("r3", "Golden Wok", ["Chinese"], 2, ["takeout", "kid_friendly"]),
    mk("r4", "Sakura Sushi", ["Japanese", "Sushi"], 3, ["reservations"]),
    mk("r5", "Burger Barn", ["American", "Burgers"], 1, ["kid_friendly", "patio", "takeout"]),
    mk("r6", "Thai Basil", ["Thai"], 2, ["takeout", "patio"]),
    mk("r7", "Le Petit Bistro", ["French"], 4, ["reservations", "date_night"]),
    mk("r8", "Curry House", ["Indian"], 2, ["takeout"]),
    mk("r9", "El Mariachi", ["Mexican"], 2, ["patio", "kid_friendly"]),
    mk("r10", "Pho Saigon", ["Vietnamese"], 1, ["takeout", "kid_friendly"], "wishlist"),
    mk("r11", "Smoke & Oak BBQ", ["BBQ", "American"], 3, ["patio"], "wishlist"),
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

  const mkVisit = (id: string, restaurantId: string, ago: number, mode: VisitMode = "dine_in"): Visit => ({
    id,
    restaurantId,
    date: daysAgo(ago),
    mode,
    note: null,
  });

  const visits: Visit[] = [
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
    profiles,
    restaurants,
    ratings,
    visits,
    voteSessions: [],
    votes: [],
    discoveries: [
      {
        placeId: "demo-disc-1",
        name: "Nonna's Wood-Fired Pizza",
        address: "456 New Spot Ave",
        rating: 4.7,
        mapsUrl: null,
        foundAt: daysAgo(2),
        dismissed: false,
      },
    ],
    seenPlaceIds: new Set(),
    settings: { ...DEFAULT_SETTINGS },
  };
}

// Survive dev-server hot reloads within a single process.
const globalStore = globalThis as unknown as { __ffStore?: Store };

function store(): Store {
  if (!globalStore.__ffStore) globalStore.__ffStore = seedStore();
  return globalStore.__ffStore;
}

function enrich(r: Restaurant, s: Store): RestaurantFull {
  const ratings: Record<string, number> = {};
  for (const rating of s.ratings) {
    if (rating.restaurantId === r.id) ratings[rating.profileId] = rating.score;
  }
  const visits = s.visits
    .filter((v) => v.restaurantId === r.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  return {
    ...r,
    ratings,
    lastVisitAt: visits[0]?.date ?? null,
    visitCount: visits.length,
  };
}

export class MemoryAdapter implements DataAdapter {
  async listProfiles(): Promise<Profile[]> {
    return [...store().profiles];
  }

  async createProfile(name: string, emoji: string, color: string): Promise<Profile> {
    const profile: Profile = { id: randomUUID(), name, emoji, color };
    store().profiles.push(profile);
    return profile;
  }

  async deleteProfile(id: string): Promise<void> {
    const s = store();
    s.profiles = s.profiles.filter((p) => p.id !== id);
    s.ratings = s.ratings.filter((r) => r.profileId !== id);
  }

  async listRestaurants(): Promise<RestaurantFull[]> {
    const s = store();
    return s.restaurants.map((r) => enrich(r, s));
  }

  async getRestaurant(id: string): Promise<RestaurantFull | null> {
    const s = store();
    const r = s.restaurants.find((x) => x.id === id);
    return r ? enrich(r, s) : null;
  }

  async createRestaurant(data: NewRestaurant): Promise<Restaurant> {
    const restaurant: Restaurant = { ...data, id: randomUUID(), createdAt: new Date().toISOString() };
    store().restaurants.push(restaurant);
    return restaurant;
  }

  async updateRestaurant(id: string, data: Partial<NewRestaurant>): Promise<void> {
    const s = store();
    const idx = s.restaurants.findIndex((x) => x.id === id);
    if (idx >= 0) s.restaurants[idx] = { ...s.restaurants[idx], ...data };
  }

  async deleteRestaurant(id: string): Promise<void> {
    const s = store();
    s.restaurants = s.restaurants.filter((x) => x.id !== id);
    s.ratings = s.ratings.filter((x) => x.restaurantId !== id);
    s.visits = s.visits.filter((x) => x.restaurantId !== id);
  }

  async setRating(restaurantId: string, profileId: string, score: number): Promise<void> {
    const s = store();
    const existing = s.ratings.find(
      (r) => r.restaurantId === restaurantId && r.profileId === profileId
    );
    if (existing) existing.score = score;
    else s.ratings.push({ restaurantId, profileId, score });
  }

  async addVisit(restaurantId: string, date: string, mode: VisitMode, note: string | null): Promise<void> {
    store().visits.push({ id: randomUUID(), restaurantId, date, mode, note });
  }

  async listRecentVisits(limit: number): Promise<Visit[]> {
    return [...store().visits].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  }

  async listVisitsForRestaurant(restaurantId: string): Promise<Visit[]> {
    return store()
      .visits.filter((v) => v.restaurantId === restaurantId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  async createVoteSession(candidateIds: string[]): Promise<VoteSession> {
    const s = store();
    // Only one open vote at a time
    for (const session of s.voteSessions) {
      if (session.status === "open") session.status = "closed";
    }
    const session: VoteSession = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: "open",
      candidateIds,
      winnerId: null,
    };
    s.voteSessions.push(session);
    return session;
  }

  async getOpenVoteSession(): Promise<VoteSession | null> {
    return store().voteSessions.find((v) => v.status === "open") ?? null;
  }

  async getLatestVoteSession(): Promise<VoteSession | null> {
    const sessions = [...store().voteSessions].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    return sessions[0] ?? null;
  }

  async getVoteSession(id: string): Promise<VoteSession | null> {
    return store().voteSessions.find((v) => v.id === id) ?? null;
  }

  async listVotes(sessionId: string): Promise<Vote[]> {
    return store().votes.filter((v) => v.sessionId === sessionId);
  }

  async castVote(
    sessionId: string,
    profileId: string,
    pickId: string | null,
    vetoId: string | null
  ): Promise<void> {
    const s = store();
    s.votes = s.votes.filter((v) => !(v.sessionId === sessionId && v.profileId === profileId));
    s.votes.push({ sessionId, profileId, pickId, vetoId });
  }

  async closeVoteSession(sessionId: string, winnerId: string | null): Promise<void> {
    const session = store().voteSessions.find((v) => v.id === sessionId);
    if (session) {
      session.status = "closed";
      session.winnerId = winnerId;
    }
  }

  async listDiscoveries(): Promise<Discovery[]> {
    return store()
      .discoveries.filter((d) => !d.dismissed)
      .sort((a, b) => b.foundAt.localeCompare(a.foundAt));
  }

  async upsertDiscoveries(items: DiscoveryInput[]): Promise<number> {
    const s = store();
    let added = 0;
    for (const item of items) {
      if (!s.discoveries.some((d) => d.placeId === item.placeId)) {
        s.discoveries.push({ ...item, foundAt: new Date().toISOString(), dismissed: false });
        added++;
      }
    }
    return added;
  }

  async dismissDiscovery(placeId: string): Promise<void> {
    const d = store().discoveries.find((x) => x.placeId === placeId);
    if (d) d.dismissed = true;
  }

  async listSeenPlaceIds(): Promise<string[]> {
    return [...store().seenPlaceIds];
  }

  async markPlacesSeen(placeIds: string[]): Promise<void> {
    for (const id of placeIds) store().seenPlaceIds.add(id);
  }

  async getSettings(): Promise<Settings> {
    return { ...store().settings };
  }

  async saveSettings(settings: Settings): Promise<void> {
    store().settings = { ...settings };
  }
}
