import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { db } from "@/lib/data";
import { placesKey, textSearch } from "@/lib/places";

export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const key = placesKey();
  if (!key) return NextResponse.json({ places: [] });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) return NextResponse.json({ places: [] });

  const settings = await db().getSettings();
  const bias =
    settings.homeLat !== null && settings.homeLng !== null
      ? { lat: settings.homeLat, lng: settings.homeLng, radiusMeters: settings.radiusMeters }
      : undefined;

  try {
    const places = await textSearch(q, key, bias);
    return NextResponse.json({ places });
  } catch {
    return NextResponse.json({ places: [] });
  }
}
