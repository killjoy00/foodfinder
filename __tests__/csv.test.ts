import { describe, expect, it } from "vitest";
import { csvEscape, restaurantsCsv, toCsv } from "../lib/csv";
import { Profile, RestaurantFull } from "../lib/types";

describe("csvEscape", () => {
  it("quotes fields with commas, quotes, and newlines", () => {
    expect(csvEscape("plain")).toBe("plain");
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape("line\nbreak")).toBe('"line\nbreak"');
    expect(csvEscape(null)).toBe("");
  });
});

describe("restaurantsCsv", () => {
  it("produces one row per restaurant with per-profile rating columns", () => {
    const profiles: Profile[] = [
      { id: "p1", name: "Mom", emoji: "🦊", color: "#fff", doubleCredits: 0 },
      { id: "p2", name: "Dad", emoji: "🐻", color: "#000", doubleCredits: 0 },
    ];
    const restaurants: RestaurantFull[] = [
      {
        id: "r1",
        name: 'The "Best" Tacos, Truly',
        cuisines: ["Mexican", "Tacos"],
        price: 2,
        address: "1 Foo St",
        lat: null,
        lng: null,
        googlePlaceId: "pid",
        mapsUrl: null,
        reserveUrl: null,
        tags: ["patio"],
        status: "active",
        notes: null,
        createdAt: "2025-01-01T00:00:00Z",
        ratings: { p1: 9 },
        lastVisitAt: "2026-06-01T19:00:00Z",
        visitCount: 4,
      },
    ];
    const csv = restaurantsCsv(restaurants, profiles);
    const [header, row] = csv.trim().split("\r\n");
    expect(header).toContain("rating_mom");
    expect(header).toContain("rating_dad");
    expect(row).toContain('"The ""Best"" Tacos, Truly"');
    expect(row).toContain("Mexican; Tacos");
    expect(row).toContain("2026-06-01");
    const cols = header.split(",");
    expect(row.split(",").length - (row.match(/"/g)!.length ? 1 : 0)).toBeGreaterThanOrEqual(
      cols.length - 1
    );
  });
});

describe("toCsv", () => {
  it("round-trips simple rows", () => {
    expect(toCsv([["a", "b"], [1, 2]])).toBe("a,b\r\n1,2\r\n");
  });
});
