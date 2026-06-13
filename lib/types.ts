export type Profile = {
  id: string;
  name: string;
  emoji: string;
  color: string;
};

export type RestaurantStatus = "active" | "wishlist";

export const PRICE_LABELS = ["$", "$$", "$$$", "$$$$"] as const;

export const TAGS = [
  "kid_friendly",
  "patio",
  "takeout",
  "reservations",
  "date_night",
  "healthy",
] as const;
export type Tag = (typeof TAGS)[number];

export const TAG_LABELS: Record<Tag, string> = {
  kid_friendly: "Kid friendly",
  patio: "Patio",
  takeout: "Good takeout",
  reservations: "Takes reservations",
  date_night: "Date night",
  healthy: "Healthy",
};

export type Restaurant = {
  id: string;
  name: string;
  cuisines: string[];
  price: number; // 1-4
  address: string | null;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
  mapsUrl: string | null;
  reserveUrl: string | null;
  tags: string[];
  status: RestaurantStatus;
  notes: string | null;
  createdAt: string;
};

/** Restaurant enriched with rating + visit aggregates for display and picking. */
export type RestaurantFull = Restaurant & {
  ratings: Record<string, number>; // profileId -> 1-10
  lastVisitAt: string | null;
  visitCount: number;
};

export type VisitMode = "dine_in" | "takeout";

export type Visit = {
  id: string;
  restaurantId: string;
  date: string; // ISO date
  mode: VisitMode;
  note: string | null;
};

export type VoteStatus = "open" | "closed";

export type VoteSession = {
  id: string;
  createdAt: string;
  status: VoteStatus;
  candidateIds: string[];
  winnerId: string | null;
};

export type Vote = {
  sessionId: string;
  profileId: string;
  pickId: string | null;
  vetoId: string | null;
};

export type Discovery = {
  placeId: string;
  name: string;
  address: string | null;
  rating: number | null;
  mapsUrl: string | null;
  foundAt: string;
  dismissed: boolean;
};

export type Settings = {
  homeLabel: string | null;
  homeLat: number | null;
  homeLng: number | null;
  radiusMeters: number;
};

export const DEFAULT_SETTINGS: Settings = {
  homeLabel: null,
  homeLat: null,
  homeLng: null,
  radiusMeters: 8000,
};

/** Build a Google Maps deep link without needing an API key. */
export function mapsLink(r: Pick<Restaurant, "name" | "address" | "mapsUrl" | "googlePlaceId">): string {
  if (r.mapsUrl) return r.mapsUrl;
  const query = encodeURIComponent([r.name, r.address].filter(Boolean).join(" "));
  if (r.googlePlaceId) {
    return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${r.googlePlaceId}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/**
 * OpenTable search deep link (works without any API). When we know where
 * the restaurant is, bias the search to that spot so "Pasta Fresca"
 * resolves to the one near you instead of every Pasta Fresca nationwide.
 */
export function openTableLink(
  r: Pick<Restaurant, "name" | "reserveUrl" | "lat" | "lng" | "address">
): string {
  if (r.reserveUrl) return r.reserveUrl;
  const params = new URLSearchParams();
  const hasCoords = r.lat !== null && r.lng !== null;
  // with coords we lean on lat/long; without, fold the address into the term
  params.set("term", hasCoords ? r.name : [r.name, r.address].filter(Boolean).join(" "));
  if (hasCoords) {
    params.set("latitude", String(r.lat));
    params.set("longitude", String(r.lng));
  }
  return `https://www.opentable.com/s?${params.toString()}`;
}

export function daysSince(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));
}
