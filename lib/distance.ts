/** Great-circle distance in miles between two lat/lng points. */
export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8; // earth radius, miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type LatLng = { lat: number | null; lng: number | null };

/** Distance in miles from an origin to a place, or null if either lacks coords. */
export function distanceMiles(origin: LatLng | null, place: LatLng): number | null {
  if (!origin || origin.lat === null || origin.lng === null) return null;
  if (place.lat === null || place.lng === null) return null;
  return haversineMiles(origin.lat, origin.lng, place.lat, place.lng);
}

/** Friendly distance label: "0.3 mi", "2.4 mi", "12 mi". */
export function formatMiles(miles: number | null): string | null {
  if (miles === null) return null;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}
