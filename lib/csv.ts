import { Profile, RestaurantFull, Visit, PRICE_LABELS } from "./types";

export function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}

export function restaurantsCsv(restaurants: RestaurantFull[], profiles: Profile[]): string {
  const header = [
    "name",
    "status",
    "cuisines",
    "price",
    "tags",
    "address",
    "google_place_id",
    "maps_url",
    "last_visit",
    "visit_count",
    "notes",
    ...profiles.map((p) => `rating_${p.name.toLowerCase().replace(/\s+/g, "_")}`),
  ];
  const rows = restaurants.map((r) => [
    r.name,
    r.status,
    r.cuisines.join("; "),
    PRICE_LABELS[r.price - 1] ?? r.price,
    r.tags.join("; "),
    r.address,
    r.googlePlaceId,
    r.mapsUrl,
    r.lastVisitAt ? r.lastVisitAt.slice(0, 10) : "",
    r.visitCount,
    r.notes,
    ...profiles.map((p) => r.ratings[p.id] ?? ""),
  ]);
  return toCsv([header, ...rows]);
}

export function visitsCsv(visits: Visit[], restaurantNames: Map<string, string>): string {
  const header = ["date", "restaurant", "mode", "note"];
  const rows = visits.map((v) => [
    v.date.slice(0, 10),
    restaurantNames.get(v.restaurantId) ?? v.restaurantId,
    v.mode,
    v.note,
  ]);
  return toCsv([header, ...rows]);
}
