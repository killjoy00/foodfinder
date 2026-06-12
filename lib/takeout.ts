/**
 * Parser for Google Takeout "Maps (your places)" exports:
 * Saved Places.json and Reviews.json. Both are GeoJSON FeatureCollections,
 * but property names have changed across Takeout versions, so we read
 * both the current snake_case keys and the older Title Case ones.
 */

export type TakeoutItem = {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  placeId: string | null;
  starRating: number | null; // 1-5 when the file is a reviews export
  kind: "saved" | "review";
  date: string | null;
};

type AnyRecord = Record<string, unknown>;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function placeIdFromUrl(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/place_id:([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

function parseFeature(feature: AnyRecord): TakeoutItem | null {
  const props = (feature.properties ?? {}) as AnyRecord;
  const location = (props.location ?? props.Location ?? {}) as AnyRecord;

  const name =
    str(location.name) ?? str(location["Business Name"]) ?? str(props.Title) ?? str(props.name);
  if (!name) return null;

  const address =
    str(location.address) ?? str(location.Address) ?? str(location["Geo Coordinates"] ? null : null);

  const geometry = (feature.geometry ?? {}) as AnyRecord;
  const coords = Array.isArray(geometry.coordinates) ? (geometry.coordinates as unknown[]) : [];
  const lng = num(coords[0]);
  const lat = num(coords[1]);

  const mapsUrl =
    str(props.google_maps_url) ?? str(props["Google Maps URL"]) ?? str(props.url);

  const starRating =
    num(props.five_star_rating_published) ??
    num(props["Star Rating"]) ??
    num(props.five_star_rating);

  return {
    name,
    address,
    lat,
    lng,
    mapsUrl,
    placeId: placeIdFromUrl(mapsUrl),
    starRating: starRating !== null && starRating >= 1 && starRating <= 5 ? starRating : null,
    kind: starRating !== null ? "review" : "saved",
    date: str(props.date) ?? str(props.Published) ?? null,
  };
}

export function parseTakeout(jsonText: string): TakeoutItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("That file isn't valid JSON. Upload Saved Places.json or Reviews.json from Google Takeout.");
  }
  const root = parsed as AnyRecord;
  const features = Array.isArray(root.features) ? (root.features as AnyRecord[]) : null;
  if (!features) {
    throw new Error("Couldn't find any places in that file. Expected a Takeout 'Maps (your places)' export.");
  }

  const items: TakeoutItem[] = [];
  const seen = new Set<string>();
  for (const feature of features) {
    const item = parseFeature(feature);
    if (!item) continue;
    const key = item.placeId ?? `${item.name}|${item.address ?? ""}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}

/** Map a 1-5 Google star rating onto our 1-10 scale. */
export function starToScore(star: number): number {
  return Math.max(1, Math.min(10, Math.round(star * 2)));
}
