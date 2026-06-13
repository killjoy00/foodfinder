import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { restaurantsCsv } from "@/lib/csv";
import { db } from "@/lib/data";

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [restaurants, profiles] = await Promise.all([(await db()).listRestaurants(), (await db()).listProfiles()]);
  return new NextResponse(restaurantsCsv(restaurants, profiles), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="foodfinder-restaurants-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
