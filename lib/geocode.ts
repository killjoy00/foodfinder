/**
 * ZIP-code geocoding via zippopotam.us — free, no API key. ZIP-centroid
 * precision is plenty for "restaurants within N miles of home".
 */

export type ZipResult = { lat: number; lng: number; label: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseZippopotam(data: any): ZipResult | null {
  const place = data?.places?.[0];
  if (!place) return null;
  const lat = parseFloat(place.latitude);
  const lng = parseFloat(place.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const label = [place["place name"], place["state abbreviation"] || place.state]
    .filter(Boolean)
    .join(", ");
  return { lat, lng, label: label || String(data["post code"] ?? "") };
}

export async function zipToCoords(zip: string, country = "us"): Promise<ZipResult | null> {
  const clean = zip.trim().replace(/[^0-9a-zA-Z-]/g, "");
  if (!clean) return null;
  try {
    const res = await fetch(`https://api.zippopotam.us/${country}/${clean}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return parseZippopotam(await res.json());
  } catch {
    return null;
  }
}

export type GeoPoint = { lat: number; lng: number };

/**
 * Geocode a free-form street address via OpenStreetMap Nominatim (free, no
 * key). Best-effort — returns null on any failure so callers don't break.
 */
export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const q = address.trim();
  if (q.length < 4) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      {
        headers: { "User-Agent": "FoodFinder/1.0 (family restaurant picker)" },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const hit = Array.isArray(data) ? data[0] : null;
    if (!hit) return null;
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}
