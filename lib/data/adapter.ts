import {
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

export type NewRestaurant = Omit<Restaurant, "id" | "createdAt">;

export type DiscoveryInput = Omit<Discovery, "foundAt" | "dismissed">;

export interface DataAdapter {
  // profiles
  listProfiles(): Promise<Profile[]>;
  createProfile(name: string, emoji: string, color: string): Promise<Profile>;
  deleteProfile(id: string): Promise<void>;

  // restaurants (returned enriched with ratings + visit aggregates)
  listRestaurants(): Promise<RestaurantFull[]>;
  getRestaurant(id: string): Promise<RestaurantFull | null>;
  createRestaurant(data: NewRestaurant): Promise<Restaurant>;
  updateRestaurant(id: string, data: Partial<NewRestaurant>): Promise<void>;
  deleteRestaurant(id: string): Promise<void>;

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
  castVote(sessionId: string, profileId: string, pickId: string | null, vetoId: string | null): Promise<void>;
  closeVoteSession(sessionId: string, winnerId: string | null): Promise<void>;

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
