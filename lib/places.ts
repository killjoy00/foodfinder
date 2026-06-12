/**
 * Thin client for the Google Places API (New). Everything here is
 * optional — the app works fully without a GOOGLE_PLACES_API_KEY; the
 * key just unlocks autocomplete, the discovery sweep, and recommendations.
 */

export type PlaceResult = {
  placeId: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  priceLevel: number | null; // 1-4 on our scale
  mapsUrl: string | null;
  types: string[];
};

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.priceLevel",
  "places.googleMapsUri",
  "places.types",
].join(",");

export function placesKey(): string | null {
  return process.env.GOOGLE_PLACES_API_KEY ?? null;
}

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function toResult(place: any): PlaceResult {
  return {
    placeId: place.id,
    name: place.displayName?.text ?? "",
    address: place.formattedAddress ?? null,
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    rating: place.rating ?? null,
    priceLevel: PRICE_LEVEL_MAP[place.priceLevel] ?? null,
    mapsUrl: place.googleMapsUri ?? null,
    types: place.types ?? [],
  };
}

async function placesPost(endpoint: string, key: string, body: unknown): Promise<PlaceResult[]> {
  const res = await fetch(`https://places.googleapis.com/v1/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.places ?? []).map(toResult).filter((p: PlaceResult) => p.name && p.placeId);
}

export async function textSearch(
  query: string,
  key: string,
  bias?: { lat: number; lng: number; radiusMeters: number }
): Promise<PlaceResult[]> {
  const body: Record<string, unknown> = {
    textQuery: query,
    includedType: "restaurant",
    maxResultCount: 8,
  };
  if (bias) {
    body.locationBias = {
      circle: {
        center: { latitude: bias.lat, longitude: bias.lng },
        radius: bias.radiusMeters,
      },
    };
  }
  return placesPost("places:searchText", key, body);
}

export async function nearbyRestaurants(
  lat: number,
  lng: number,
  radiusMeters: number,
  key: string
): Promise<PlaceResult[]> {
  return placesPost("places:searchNearby", key, {
    includedTypes: ["restaurant"],
    maxResultCount: 20,
    rankPreference: "POPULARITY",
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: Math.min(radiusMeters, 50000),
      },
    },
  });
}
