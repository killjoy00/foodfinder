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

  const address = str(location.address) ?? str(location.Address);

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
    // dedupe by place id; else by name+address; else (no address) fall back to
    // name+coords so two distinct same-name places aren't wrongly merged
    const key = (
      item.placeId ??
      (item.address
        ? `${item.name}|${item.address}`
        : item.lat !== null && item.lng !== null
          ? `${item.name}|${item.lat},${item.lng}`
          : item.name)
    ).toLowerCase();
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

// ---------- Takeout "Saved" lists (CSV per list: Title,Note,URL[,Comment]) ----------

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

export function parseTakeoutCsv(csvText: string): TakeoutItem[] {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    throw new Error("That CSV looks empty.");
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const titleIdx = header.indexOf("title");
  const urlIdx = header.indexOf("url");
  if (titleIdx === -1) {
    throw new Error(
      "Couldn't find a Title column. Expected a list CSV from Takeout's “Saved” export (Title,Note,URL)."
    );
  }
  const items: TakeoutItem[] = [];
  const seen = new Set<string>();
  for (const row of rows.slice(1)) {
    const name = (row[titleIdx] ?? "").trim();
    if (!name) continue;
    const mapsUrl = urlIdx >= 0 ? (row[urlIdx] ?? "").trim() || null : null;
    const key = (mapsUrl ?? name).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      name,
      address: null,
      lat: null,
      lng: null,
      mapsUrl,
      placeId: placeIdFromUrl(mapsUrl),
      starRating: null,
      kind: "saved",
      date: null,
    });
  }
  return items;
}

/** Accepts either Takeout format: GeoJSON (Maps your places) or CSV (Saved lists). */
export function parseTakeoutAny(text: string, filename = ""): TakeoutItem[] {
  const trimmed = text.trimStart();
  if (filename.toLowerCase().endsWith(".csv") || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
    return parseTakeoutCsv(text);
  }
  return parseTakeout(text);
}
