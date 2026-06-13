import { describe, expect, it } from "vitest";
import { findDuplicatePairs, normalizeName, similarity } from "../lib/duplicates";
import { RestaurantFull } from "../lib/types";

function r(overrides: Partial<RestaurantFull>): RestaurantFull {
  return {
    id: Math.random().toString(36).slice(2),
    name: "Place",
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
    ...overrides,
  };
}

describe("normalizeName", () => {
  it("lowercases, strips punctuation and noise words", () => {
    expect(normalizeName("The Joe's Pizza Restaurant!")).toBe("joe s pizza");
    expect(normalizeName("Taquería Lúna")).toBe("taqueria luna");
  });
});

describe("similarity", () => {
  it("is 1 for identical and lower for edits", () => {
    expect(similarity("joes pizza", "joes pizza")).toBe(1);
    expect(similarity("joes pizza", "joe pizza")).toBeGreaterThan(0.85);
    expect(similarity("joes pizza", "thai basil")).toBeLessThan(0.4);
  });
});

describe("findDuplicatePairs", () => {
  it("flags identical Google place ids as high confidence", () => {
    const pairs = findDuplicatePairs([
      r({ id: "1", name: "Joe's", googlePlaceId: "PID" }),
      r({ id: "2", name: "Joe's Pizza", googlePlaceId: "PID" }),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].confidence).toBe("high");
    expect(pairs[0].reason).toMatch(/Google place/);
  });

  it("flags identical normalized names", () => {
    const pairs = findDuplicatePairs([
      r({ id: "1", name: "The Golden Wok" }),
      r({ id: "2", name: "Golden Wok Restaurant" }),
    ]);
    expect(pairs[0]?.confidence).toBe("high");
  });

  it("flags very similar names only when close or location unknown", () => {
    const near = findDuplicatePairs([
      r({ id: "1", name: "Pasta Fresca", lat: 37.0, lng: -122.0 }),
      r({ id: "2", name: "Pasta Frescaa", lat: 37.001, lng: -122.001 }),
    ]);
    expect(near.length).toBe(1);

    const far = findDuplicatePairs([
      r({ id: "1", name: "Pasta Fresca", lat: 37.0, lng: -122.0 }),
      r({ id: "2", name: "Pasta Frescaa", lat: 40.0, lng: -100.0 }),
    ]);
    expect(far.length).toBe(0);
  });

  it("does not flag clearly different places", () => {
    expect(
      findDuplicatePairs([r({ name: "Thai Basil" }), r({ name: "Burger Barn" })])
    ).toHaveLength(0);
  });
});
