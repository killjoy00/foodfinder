import {
  Discovery,
  Household,
  Nomination,
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

export type NewRestaurant = Omit<Restaurant, "id" | "createdAt">;

export type DiscoveryInput = Omit<Discovery, "foundAt" | "dismissed">;

export type HouseholdAuth = { id: string; name: string; passwordHash: string };

/** A row to add to the shared master catalog (not tracked by any group). */
export type CatalogInput = {
  name: string;
  cuisines: string[];
  price: number;
  address: string | null;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
  mapsUrl: string | null;
};

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
  setHouseholdPassword(id: string, passwordHash: string): Promise<void>;
}

export interface DataAdapter {
  // profiles
  listProfiles(): Promise<Profile[]>;
  createProfile(name: string, emoji: string, color: string): Promise<Profile>;
  updateProfile(id: string, data: Partial<Omit<Profile, "id">>): Promise<void>;
  deleteProfile(id: string): Promise<void>;

  // brands (the family's tracked unit — one entry per restaurant, grouping its
  // locations; returned enriched with brand-wide ratings + pooled visits).
  // `id` arguments below are BRAND ids unless named restaurantId (a catalog
  // location id).
  listRestaurants(): Promise<RestaurantFull[]>;
  getRestaurant(id: string): Promise<RestaurantFull | null>;
  /** Add a catalog location and track it under its brand; returns the brand. */
  createRestaurant(data: NewRestaurant): Promise<Restaurant>;
  /** Edit brand-level fields (name/status/notes/cuisines), and catalog facts when the brand has a single location. */
  updateRestaurant(id: string, data: Partial<NewRestaurant>): Promise<void>;
  /** Untrack a brand (its locations stay in the shared catalog). */
  deleteRestaurant(id: string): Promise<void>;
  /** Stop tracking every wishlist brand for this group; returns how many. */
  clearWishlist(): Promise<number>;
  /** The shared master catalog, flagged with whether this group tracks each. */
  listCatalog(): Promise<CatalogEntry[]>;
  /** A single catalog location (for geocoding on track). */
  getCatalogLocation(restaurantId: string): Promise<RestaurantLocation | null>;
  /** Set a catalog location's coordinates (used after geocoding). */
  setLocationCoords(restaurantId: string, lat: number, lng: number): Promise<void>;
  /** Track a catalog location under its brand; returns the brand id. */
  trackRestaurant(restaurantId: string, status: "active" | "wishlist"): Promise<string>;
  /** Bulk-add rows to the shared catalog, skipping dupes; returns count added. */
  addCatalogEntries(entries: CatalogInput[]): Promise<number>;
  /** Merge brand `loserId` into `survivorId` (locations, ratings (highest wins), visits), then delete the loser brand. */
  mergeRestaurants(survivorId: string, loserId: string): Promise<void>;
  /** Split one location out of `brandId` into its own brand; returns the new brand id. */
  splitLocation(brandId: string, restaurantId: string): Promise<string>;

  // ratings (brand-wide: one score per person per brand)
  setRating(brandId: string, profileId: string, score: number): Promise<void>;
  clearRating(brandId: string, profileId: string): Promise<void>;

  // visits (logged at the brand level, pooled across locations)
  addVisit(brandId: string, date: string, mode: VisitMode, note: string | null): Promise<void>;
  listRecentVisits(limit: number): Promise<Visit[]>;
  listVisitsForRestaurant(brandId: string): Promise<Visit[]>;

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
  /** Close a session; returns false when it had already left the open/nominating state (idempotence guard). */
  closeVoteSession(sessionId: string, winnerId: string | null): Promise<boolean>;
  setDoubleCredits(profileId: string, credits: number): Promise<void>;

  // nomination rounds (a vote session in the 'nominating' phase)
  createNominationSession(): Promise<VoteSession>;
  getNominatingSession(): Promise<VoteSession | null>;
  listNominations(sessionId: string): Promise<Nomination[]>;
  addNomination(sessionId: string, profileId: string, brandId: string): Promise<void>;
  removeNomination(sessionId: string, profileId: string, brandId: string): Promise<void>;
  /** Move a nominating session to open voting with the given ballot; returns false unless it was nominating. */
  openVoting(sessionId: string, candidateIds: string[]): Promise<boolean>;

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
