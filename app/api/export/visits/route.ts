import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { visitsCsv } from "@/lib/csv";
import { db } from "@/lib/data";

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [visits, restaurants] = await Promise.all([
    (await db()).listRecentVisits(10000),
    (await db()).listRestaurants(),
  ]);
  const names = new Map(restaurants.map((r) => [r.id, r.name]));
  return new NextResponse(visitsCsv(visits, names), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="foodfinder-visits-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
