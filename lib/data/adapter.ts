import {
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

export type NewRestaurant = Omit<Restaurant, "id" | "createdAt">;

export type DiscoveryInput = Omit<Discovery, "foundAt" | "dismissed">;

export type HouseholdAuth = { id: string; name: string; passwordHash: string };

/** A catalog (master-list) entry, with whether the current group tracks it. */
export type CatalogEntry = {
  id: string;
  name: string;
  cuisines: string[];
  price: number;
  address: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  tracked: boolean;
  trackedStatus: "active" | "wishlist" | null;
};

/** Tenant registry — NOT scoped to a single household. Used by auth only. */
export interface HouseholdRegistry {
  createHousehold(name: string, passwordHash: string): Promise<Household>;
  findHouseholdByName(name: string): Promise<HouseholdAuth | null>;
  getHousehold(id: string): Promise<Household | null>;
  listHouseholds(): Promise<Household[]>;
}

export interface DataAdapter {
  // profiles
  listProfiles(): Promise<Profile[]>;
  createProfile(name: string, emoji: string, color: string): Promise<Profile>;
  updateProfile(id: string, data: Partial<Omit<Profile, "id">>): Promise<void>;
  deleteProfile(id: string): Promise<void>;

  // restaurants (returned enriched with ratings + visit aggregates)
  listRestaurants(): Promise<RestaurantFull[]>;
  getRestaurant(id: string): Promise<RestaurantFull | null>;
  createRestaurant(data: NewRestaurant): Promise<Restaurant>;
  updateRestaurant(id: string, data: Partial<NewRestaurant>): Promise<void>;
  deleteRestaurant(id: string): Promise<void>;
  /** Stop tracking every wishlist restaurant for this group; returns how many. */
  clearWishlist(): Promise<number>;
  /** The shared master catalog, flagged with whether this group tracks each. */
  listCatalog(): Promise<CatalogEntry[]>;
  /** Add a catalog restaurant to this group's list (active = been there). */
  trackRestaurant(restaurantId: string, status: "active" | "wishlist"): Promise<void>;
  /** Fold `loserId` into `survivorId` (visits, ratings, tags, cuisines), then delete the loser. */
  mergeRestaurants(survivorId: string, loserId: string): Promise<void>;

  // ratings
  setRating(restaurantId: string, profileId: string, score: number): Promise<void>;

  // visits
  addVisit(restaurantId: string, date: string, mode: VisitMode, note: string | null): Promise<void>;
  listRecentVisits(limit: number): Promise<Visit[]>;
  listVisitsForRestaurant(restaurantId: string): Promise<Visit[]>;

  // family vote
  createVoteSession(candidateIds: string[]): Promise<VoteSession>;
  getOpenVoteSession(): Promise<VoteSession | null>;
  getLatestVoteSession(): Promise<VoteSession | null>;
  getVoteSession(id: string): Promise<VoteSession | null>;
  listVotes(sessionId: string): Promise<Vote[]>;
  castVote(
    sessionId: string,
    profileId: string,
    pickId: string | null,
    vetoId: string | null,
    deferred: boolean
  ): Promise<void>;
  closeVoteSession(sessionId: string, winnerId: string | null): Promise<void>;
  setDoubleCredits(profileId: string, credits: number): Promise<void>;

  // discovery feed
  listDiscoveries(): Promise<Discovery[]>;
  upsertDiscoveries(items: DiscoveryInput[]): Promise<number>;
  dismissDiscovery(placeId: string): Promise<void>;
  listSeenPlaceIds(): Promise<string[]>;
  markPlacesSeen(placeIds: string[]): Promise<void>;

  // settings
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
}
