/**
 * Parser for a "master list" restaurant CSV uploaded to seed the shared
 * catalog. Flexible about column names: it recognizes the Austin export
 * (Name, Neighborhood, Cuisine, Price, Google Maps) and generic variants.
 */

export type CatalogRow = {
  name: string;
  cuisines: string[];
  price: number; // 1-4
  address: string | null;
  googlePlaceId: string | null;
  mapsUrl: string | null;
  lat: number | null;
  lng: number | null;
};

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

export function priceTier(raw: string): number {
  const s = (raw || "").trim();
  if (/^\$+$/.test(s)) return Math.min(4, s.length);
  const nums = (s.match(/\d+/g) || []).map(Number);
  if (nums.length === 0) return 2;
  const hi = Math.max(...nums);
  if (hi <= 15) return 1;
  if (hi <= 30) return 2;
  if (hi <= 60) return 3;
  return 4;
}

function placeIdFrom(url: string): string | null {
  const m = url.match(/query_place_id=([A-Za-z0-9_-]+)/) || url.match(/place_id:([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

function num(v: string | undefined): number | null {
  if (v === undefined) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export function parseCatalogCsv(text: string, city = ""): CatalogRow[] {
  const rows = parseCsvRows(text.replace(/^﻿/, ""));
  if (rows.length < 2) throw new Error("That CSV has no rows.");
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const find = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const iName = find("name", "restaurant", "title");
  if (iName < 0) throw new Error("Couldn't find a Name column.");
  const iCuisine = find("cuisine", "cuisines", "category", "type");
  const iPrice = find("price", "price range", "cost");
  const iAddress = find("address", "neighborhood", "area", "location");
  const iMaps = find("google maps", "maps", "url", "google maps url", "link");
  const iPid = find("place_id", "google_place_id", "place id");
  const iLat = find("lat", "latitude");
  const iLng = find("lng", "lon", "long", "longitude");

  const out: CatalogRow[] = [];
  const seen = new Set<string>();
  for (const r of rows.slice(1)) {
    const name = (r[iName] || "").trim();
    if (!name) continue;
    const mapsUrl = iMaps >= 0 ? (r[iMaps] || "").trim() || null : null;
    const googlePlaceId =
      (iPid >= 0 ? (r[iPid] || "").trim() : "") || (mapsUrl ? placeIdFrom(mapsUrl) : null) || null;

    const key = (googlePlaceId || name).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const cuisineCell = iCuisine >= 0 ? (r[iCuisine] || "").trim() : "";
    // a single category like "Mexican & Tex-Mex" stays one cuisine; a list
    // separated by ; or / is split
    const cuisines = cuisineCell
      ? cuisineCell.split(/\s*[;/]\s*/).map((c) => c.trim()).filter(Boolean)
      : [];

    const areaOrAddress = iAddress >= 0 ? (r[iAddress] || "").trim() : "";
    const address = areaOrAddress
      ? city && !areaOrAddress.toLowerCase().includes(city.toLowerCase())
        ? `${areaOrAddress}, ${city}`
        : areaOrAddress
      : city || null;

    out.push({
      name,
      cuisines,
      price: priceTier(iPrice >= 0 ? r[iPrice] : ""),
      address,
      googlePlaceId,
      mapsUrl,
      lat: iLat >= 0 ? num(r[iLat]) : null,
      lng: iLng >= 0 ? num(r[iLng]) : null,
    });
  }
  return out;
}
