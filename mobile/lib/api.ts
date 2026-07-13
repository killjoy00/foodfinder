import type { CatalogEntry, CatalogInput } from "@shared/data/adapter";
import type { PlaceResult } from "@shared/places";
import type { RecommendationGroup, RecommendationPick } from "@shared/services";
import type { SweepResult } from "@shared/sweep";
import type { TakeoutItem } from "@shared/takeout";
import type {
  Discovery,
  Household,
  Profile,
  RestaurantFull,
  Settings,
  Visit,
  VisitMode,
  Vote,
  VoteSession,
} from "@shared/types";

/**
 * Client for the FoodFinder mobile API (app/api/mobile/* on the server).
 * Auth is the signed household token as a bearer header plus the chosen
 * profile id as X-FF-Profile — the server treats them exactly like the
 * web app's cookies.
 */

export type ApiSession = {
  baseUrl: string;
  token: string;
  profileId: string | null;
};

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export type Bootstrap = {
  household: Household | null;
  profiles: Profile[];
  restaurants: RestaurantFull[];
  recentVisits: Visit[];
  settings: Settings;
  vote: { session: VoteSession; votes: Vote[] } | null;
  demo: boolean;
};

export function normalizeBaseUrl(url: string): string {
  let u = url.trim().replace(/\/+$/, "");
  if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

async function request<T>(
  session: ApiSession,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${session.baseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        ...(session.profileId ? { "X-FF-Profile": session.profileId } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiRequestError(0, "Can't reach the server — check your connection and server URL.");
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiRequestError(res.status, `Unexpected response from the server (${res.status}).`);
  }
  if (!res.ok) {
    const message =
      (data as { error?: string })?.error ?? `The server said no (${res.status}).`;
    throw new ApiRequestError(res.status, message);
  }
  return data as T;
}

export function makeApi(session: ApiSession) {
  const get = <T>(path: string) => request<T>(session, "GET", path);
  const post = <T>(path: string, body?: unknown) => request<T>(session, "POST", path, body ?? {});
  const put = <T>(path: string, body: unknown) => request<T>(session, "PUT", path, body);
  const patch = <T>(path: string, body: unknown) => request<T>(session, "PATCH", path, body);
  const del = <T>(path: string) => request<T>(session, "DELETE", path);

  return {
    // auth (login/createGroup are static — see below — since they need no token)
    changePassword: (password: string) =>
      post<{ ok: boolean }>("/api/mobile/auth/change-password", { password }),

    bootstrap: () => get<Bootstrap>("/api/mobile/bootstrap"),

    // profiles
    listProfiles: () => get<{ profiles: Profile[] }>("/api/mobile/profiles"),
    createProfile: (name: string, emoji: string, color: string) =>
      post<{ profile: Profile }>("/api/mobile/profiles", { name, emoji, color }),
    updateProfile: (id: string, data: { name: string; emoji: string; color: string }) =>
      patch<{ ok: boolean }>(`/api/mobile/profiles/${id}`, data),
    deleteProfile: (id: string) => del<{ ok: boolean }>(`/api/mobile/profiles/${id}`),

    // restaurants
    listRestaurants: () => get<{ restaurants: RestaurantFull[] }>("/api/mobile/restaurants"),
    getRestaurant: (id: string) =>
      get<{ restaurant: RestaurantFull; visits: Visit[] }>(`/api/mobile/restaurants/${id}`),
    createRestaurant: (data: Record<string, unknown>) =>
      post<{ restaurant: RestaurantFull }>("/api/mobile/restaurants", data),
    updateRestaurant: (id: string, data: Record<string, unknown>) =>
      patch<{ restaurant: RestaurantFull }>(`/api/mobile/restaurants/${id}`, data),
    untrackRestaurant: (id: string) => del<{ ok: boolean }>(`/api/mobile/restaurants/${id}`),
    setStatus: (id: string, status: "active" | "wishlist") =>
      post<{ ok: boolean }>(`/api/mobile/restaurants/${id}/status`, { status }),
    setRating: (id: string, profileId: string, score: number | null) =>
      put<{ restaurant: RestaurantFull }>(`/api/mobile/restaurants/${id}/rating`, {
        profileId,
        score,
      }),
    logVisit: (id: string, mode: VisitMode, note?: string) =>
      post<{ restaurant: RestaurantFull }>(`/api/mobile/restaurants/${id}/visits`, { mode, note }),
    listVisitsFor: (id: string) => get<{ visits: Visit[] }>(`/api/mobile/restaurants/${id}/visits`),
    listRecentVisits: (limit = 50) => get<{ visits: Visit[] }>(`/api/mobile/visits?limit=${limit}`),
    splitLocation: (brandId: string, restaurantId: string) =>
      post<{ newBrandId: string }>(`/api/mobile/restaurants/${brandId}/split`, { restaurantId }),
    mergeRestaurants: (survivorId: string, loserId: string) =>
      post<{ ok: boolean }>("/api/mobile/restaurants/merge", { survivorId, loserId }),
    listCatalog: () => get<{ catalog: CatalogEntry[] }>("/api/mobile/restaurants/catalog"),
    addCatalogEntries: (entries: CatalogInput[]) =>
      post<{ added: number }>("/api/mobile/restaurants/catalog", { entries }),
    trackRestaurant: (restaurantId: string, status: "active" | "wishlist") =>
      post<{ ok: boolean }>("/api/mobile/restaurants/track", { restaurantId, status }),
    clearWishlist: () => post<{ removed: number }>("/api/mobile/restaurants/clear-wishlist"),

    // votes
    getVote: () =>
      get<{ session: VoteSession | null; votes: Vote[] }>("/api/mobile/vote"),
    startVote: (candidateIds: string[]) =>
      post<{ session: VoteSession }>("/api/mobile/vote/start", { candidateIds }),
    startQuickVote: (count: number) =>
      post<{ session: VoteSession }>("/api/mobile/vote/start", { count }),
    castVote: (sessionId: string, pickId: string | null, vetoId: string | null, deferred = false) =>
      post<{ votes: Vote[] }>("/api/mobile/vote/cast", { sessionId, pickId, vetoId, deferred }),
    closeVote: (sessionId: string) =>
      post<{ session: VoteSession }>("/api/mobile/vote/close", { sessionId }),
    cancelVote: (sessionId: string) =>
      post<{ ok: boolean }>("/api/mobile/vote/cancel", { sessionId }),

    // discover
    listDiscoveries: () => get<{ discoveries: Discovery[] }>("/api/mobile/discover"),
    dismissDiscovery: (placeId: string) =>
      post<{ ok: boolean }>("/api/mobile/discover/dismiss", { placeId }),
    addDiscoveryToWishlist: (placeId: string) =>
      post<{ ok: boolean }>("/api/mobile/discover/wishlist", { placeId }),
    runSweep: () => post<SweepResult>("/api/mobile/discover/sweep"),
    fetchRecommendations: (radiusMiles?: number) =>
      get<{ groups: RecommendationGroup[] }>(
        `/api/mobile/discover/recommendations${radiusMiles ? `?radius=${radiusMiles}` : ""}`
      ),
    addRecommendationToWishlist: (place: RecommendationPick) =>
      post<{ ok: boolean }>("/api/mobile/discover/recommendations/wishlist", { place }),

    // settings
    getSettings: () => get<{ settings: Settings }>("/api/mobile/settings"),
    saveSettings: (settings: Partial<Settings>) =>
      put<{ settings: Settings }>("/api/mobile/settings", settings),
    saveHomeLocation: (input: {
      zip?: string;
      homeLabel?: string;
      homeLat?: number | null;
      homeLng?: number | null;
      radiusMiles?: number | null;
    }) => post<{ message: string; settings: Settings }>("/api/mobile/settings/location", input),

    // import & search
    importTakeout: (items: TakeoutItem[]) =>
      post<{ imported: number; skipped: number }>("/api/mobile/import/takeout", { items }),
    searchPlaces: (q: string) =>
      get<{ places: PlaceResult[] }>(`/api/places/search?q=${encodeURIComponent(q)}`),

    /** Fetch a CSV export as text (shared from the device via the share sheet). */
    exportCsv: async (kind: "restaurants" | "visits") => {
      const res = await fetch(`${session.baseUrl}/api/export/${kind}`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (!res.ok) throw new ApiRequestError(res.status, "Export failed.");
      return res.text();
    },
  };
}

export type Api = ReturnType<typeof makeApi>;

export type LoginResult = { token: string; household: Household; demo: boolean };

export async function loginToGroup(
  baseUrl: string,
  group: string,
  password: string
): Promise<LoginResult> {
  return request<LoginResult>(
    { baseUrl, token: "", profileId: null },
    "POST",
    "/api/mobile/auth/login",
    { group, password }
  );
}

export async function createGroup(
  baseUrl: string,
  group: string,
  password: string
): Promise<LoginResult> {
  return request<LoginResult>(
    { baseUrl, token: "", profileId: null },
    "POST",
    "/api/mobile/auth/create-group",
    { group, password }
  );
}
