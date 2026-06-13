import { describe, expect, it } from "vitest";
import { computeInsights } from "../lib/insights";
import { Profile, RestaurantFull, Visit } from "../lib/types";

const profiles: Profile[] = [
  { id: "p1", name: "Mom", emoji: "🦊", color: "#f97316", doubleCredits: 0 },
  { id: "p2", name: "Dad", emoji: "🐻", color: "#3b82f6", doubleCredits: 0 },
];

function r(over: Partial<RestaurantFull>): RestaurantFull {
  return {
    id: "x",
    name: "X",
    cuisines: [],
    price: 2,
    address: null,
    lat: null,
    lng: null,
    googlePlaceId: null,
    mapsUrl: null,
    reserveUrl: null,
    tags: [],
    status: "active",
    notes: null,
    createdAt: "2025-01-01T00:00:00Z",
    ratings: {},
    lastVisitAt: null,
    visitCount: 0,
    ...over,
  };
}

const NOW = new Date("2026-06-13T00:00:00Z");
const iso = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();

describe("computeInsights", () => {
  const restaurants = [
    r({ id: "a", name: "Taco A", cuisines: ["Mexican"], price: 1, ratings: { p1: 9, p2: 8 }, visitCount: 5, lastVisitAt: iso(2) }),
    r({ id: "b", name: "Pasta B", cuisines: ["Italian"], price: 3, ratings: { p1: 9, p2: 3 }, visitCount: 1, lastVisitAt: iso(60) }),
    r({ id: "c", name: "Wish C", cuisines: ["Thai"], price: 2, status: "wishlist" }),
  ];
  const visits: Visit[] = [
    { id: "v1", restaurantId: "a", date: iso(2), mode: "dine_in", note: null },
    { id: "v2", restaurantId: "a", date: iso(10), mode: "takeout", note: null },
    { id: "v3", restaurantId: "b", date: iso(60), mode: "dine_in", note: null },
  ];

  it("counts places, wishlist, and visits", () => {
    const i = computeInsights(restaurants, visits, profiles, NOW);
    expect(i.totalActive).toBe(2);
    expect(i.totalWishlist).toBe(1);
    expect(i.totalVisits).toBe(3);
    expect(i.takeoutShare).toBeCloseTo(1 / 3);
  });

  it("ranks most visited and top rated", () => {
    const i = computeInsights(restaurants, visits, profiles, NOW);
    expect(i.mostVisited[0].restaurant.id).toBe("a");
    expect(i.topRated[0].restaurant.id).toBe("a"); // avg 8.5 vs 6
  });

  it("surfaces loved-but-neglected favorites", () => {
    // a high-rated place not visited in 90 days should surface
    const withFav = [
      ...restaurants,
      r({ id: "d", name: "Old Fave", cuisines: ["Sushi"], ratings: { p1: 9, p2: 9 }, lastVisitAt: iso(90), visitCount: 2 }),
    ];
    const i2 = computeInsights(withFav, visits, profiles, NOW);
    expect(i2.overdueFavorites.some((x) => x.restaurant.id === "d")).toBe(true);
  });

  it("computes agreement only with enough shared ratings", () => {
    const i = computeInsights(restaurants, visits, profiles, NOW);
    // only 2 shared ratings (a,b) -> below the 3 threshold
    expect(i.agreement).toBeNull();
  });
});
