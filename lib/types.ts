export type Household = {
  id: string;
  name: string;
};

export type Profile = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  doubleCredits: number; // banked "defer" credits; each makes one future vote count 2x
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

/**
 * "Special" cuisines are hidden from the wheel unless explicitly chosen, and
 * are mutually exclusive with other cuisine selections. Detection is
 * token-based, so a combined label like "Coffee/Tea" still counts (but
 * "Steak", which merely contains the letters "tea", does not).
 */
export const SPECIAL_CUISINE_KEYWORDS = ["dessert", "coffee", "tea"] as const;

const SPECIAL_KEYWORD_EMOJI: Record<string, string> = {
  dessert: "🍰",
  coffee: "☕",
  tea: "🍵",
};

function cuisineTokens(cuisine: string): string[] {
  return cuisine.toLowerCase().split(/[^a-z]+/).filter(Boolean);
}

export function isSpecialCuisine(cuisine: string): boolean {
  return cuisineTokens(cuisine).some((t) =>
    (SPECIAL_CUISINE_KEYWORDS as readonly string[]).includes(t)
  );
}

/** Emoji to badge a special cuisine chip, or null for ordinary cuisines. */
export function specialCuisineEmoji(cuisine: string): string | null {
  for (const t of cuisineTokens(cuisine)) {
    if (SPECIAL_KEYWORD_EMOJI[t]) return SPECIAL_KEYWORD_EMOJI[t];
  }
  return null;
}

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
  deferred: boolean; // sat this one out to bank a double-strength vote for next time
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

/** Build a Google Maps deep link that reliably pins the right place. */
export function mapsLink(
  r: Pick<Restaurant, "name" | "address" | "mapsUrl" | "googlePlaceId" | "lat" | "lng">
): string {
  const text = encodeURIComponent([r.name, r.address].filter(Boolean).join(" "));
  // a Google place id pins the exact business — most reliable
  if (r.googlePlaceId) {
    return `https://www.google.com/maps/search/?api=1&query=${text}&query_place_id=${r.googlePlaceId}`;
  }
  // otherwise drop a pin at the known coordinates
  if (r.lat !== null && r.lng !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${r.lat}%2C${r.lng}`;
  }
  if (r.mapsUrl) return r.mapsUrl;
  return `https://www.google.com/maps/search/?api=1&query=${text}`;
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
