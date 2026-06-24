import { RestaurantFull, RestaurantLocation, RestaurantStatus } from "./types";
import { LatLng, distanceMiles } from "./distance";

/**
 * Normalized brand key: every "Chick-fil-A", "chick fil a", "Chick-Fil-A #2"
 * collapses to the same key so locations auto-group by brand. (Manual
 * split/merge can override this by assigning a different brand id.)
 */
export function brandKey(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
}

/** The location closest to `origin`, or the first when we can't measure. */
export function nearestLocation(
  locations: RestaurantLocation[],
  origin: LatLng | null | undefined
): RestaurantLocation | null {
  if (locations.length === 0) return null;
  if (!origin || origin.lat === null || origin.lng === null) return locations[0];
  let best = locations[0];
  let bestDist = Infinity;
  for (const loc of locations) {
    const d = distanceMiles(origin, loc);
    if (d !== null && d < bestDist) {
      bestDist = d;
      best = loc;
    }
  }
  return best;
}

/** Distance from `origin` to the brand's nearest located branch (or null). */
export function brandDistanceMiles(
  brand: Pick<RestaurantFull, "locations">,
  origin: LatLng | null | undefined
): number | null {
  let best: number | null = null;
  for (const loc of brand.locations) {
    const d = distanceMiles(origin ?? null, loc);
    if (d !== null && (best === null || d < best)) best = d;
  }
  return best;
}

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Assemble a brand into the RestaurantFull shape the app already speaks. The
 * representative location (nearest to `home`, else the first) supplies the
 * address/coords/maps fields; cuisines and tags pool across every branch.
 */
export function buildBrand(args: {
  id: string;
  name: string;
  status: RestaurantStatus;
  notes: string | null;
  createdAt: string;
  locations: RestaurantLocation[];
  ratings: Record<string, number>;
  lastVisitAt: string | null;
  visitCount: number;
  home?: LatLng | null;
  cuisineOverride?: string[] | null;
}): RestaurantFull {
  const rep = nearestLocation(args.locations, args.home) ?? null;
  const cuisines =
    args.cuisineOverride ?? uniq(args.locations.flatMap((l) => l.cuisines));
  return {
    id: args.id,
    name: args.name,
    cuisines,
    price: rep?.price ?? 2,
    address: rep?.address ?? null,
    lat: rep?.lat ?? null,
    lng: rep?.lng ?? null,
    googlePlaceId: rep?.googlePlaceId ?? null,
    mapsUrl: rep?.mapsUrl ?? null,
    reserveUrl: rep?.reserveUrl ?? null,
    tags: uniq(args.locations.flatMap((l) => l.tags)),
    status: args.status,
    notes: args.notes,
    createdAt: args.createdAt,
    ratings: args.ratings,
    lastVisitAt: args.lastVisitAt,
    visitCount: args.visitCount,
    locations: args.locations,
    locationCount: args.locations.length,
  };
}
