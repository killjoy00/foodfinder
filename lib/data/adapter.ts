import {
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

/** What the owner sees about each signed-up group in the admin console. */
export type AdminHouseholdSummary = {
  id: string;
  name: string;
  createdAt: string | null;
  profileCount: number;
  profileNames: string[];
  trackedCount: number;
  visitCount: number;
  lastVisitAt: string | null;
};

/** A master-catalog row as shown in the admin editor. */
export type AdminCatalogRow = {
  id: string;
  name: string;
  cuisines: string[];
  price: number;
  address: string | null;
  googlePlaceId: string | null;
  mapsUrl: string | null;
  trackedBy: number; // how many groups track this location
};

/** Fields the admin may edit on a catalog row (place id is its identity — never editable). */
export type AdminCatalogPatch = Partial<{
  name: string;
  cuisines: string[];
  price: number;
  address: string | null;
  mapsUrl: string | null;
}>;

/** Tenant registry — NOT scoped to a single household. Used by auth and the admin console. */
export interface HouseholdRegistry {
  createHousehold(name: string, passwordHash: string): Promise<Household>;
  findHouseholdByName(name: string): Promise<HouseholdAuth | null>;
  getHousehold(id: string): Promise<Household | null>;
  listHouseholds(): Promise<Household[]>;
  setHouseholdPassword(id: string, passwordHash: string): Promise<void>;

  // admin console (cross-tenant; every caller must be behind requireAdmin)
  listHouseholdSummaries(): Promise<AdminHouseholdSummary[]>;
  renameHousehold(id: string, name: string): Promise<{ ok: boolean; error?: string }>;
  /** Remove a group and everything it owns (profiles, list, ratings, visits…). */
  deleteHousehold(id: string): Promise<void>;
  listCatalogAdmin(): Promise<AdminCatalogRow[]>;
  updateCatalogRow(id: string, patch: AdminCatalogPatch): Promise<void>;
  /** Delete a catalog location; brands left with no locations are cleaned up. */
  deleteCatalogRow(id: string): Promise<void>;
  /** Bulk-add rows to the shared catalog, skipping dupes; returns count added. */
  addCatalogEntries(entries: CatalogInput[]): Promise<number>;
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
  /**
   * Track many catalog locations at once (onboarding / "add all"). Batched;
   * already-tracked locations are left untouched (their brand keeps its
   * status). Returns how many locations were newly linked.
   */
  trackRestaurantsBulk(restaurantIds: string[], status: "active" | "wishlist"): Promise<number>;
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
