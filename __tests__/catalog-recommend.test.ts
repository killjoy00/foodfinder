import { describe, expect, it } from "vitest";
import {
  buildTokenAffinity,
  catalogNeighborhoods,
  neighborhoodOf,
  recommendFromCatalog,
} from "../lib/catalogRecommend";
import { CatalogEntry } from "../lib/data/adapter";
import { RestaurantFull } from "../lib/types";

function rf(over: Partial<RestaurantFull>): RestaurantFull {
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

function ce(over: Partial<CatalogEntry>): CatalogEntry {
  return {
    id: Math.random().toString(36).slice(2),
    name: "Cat",
    cuisines: [],
    price: 2,
    address: null,
    lat: null,
    lng: null,
    mapsUrl: null,
    tracked: false,
    trackedStatus: null,
    ...over,
  };
}

describe("buildTokenAffinity", () => {
  it("scores cuisine tokens by the family's average rating", () => {
    const aff = buildTokenAffinity([
      rf({ cuisines: ["Mexican"], ratings: { a: 9, b: 7 } }), // avg 8
      rf({ cuisines: ["Sushi"], ratings: { a: 3 } }), // avg 3
    ]);
    expect(aff.get("mexican")).toBe(8);
    expect(aff.get("sushi")).toBe(3);
  });
});

describe("recommendFromCatalog", () => {
  it("recommends untried places whose cuisine token matches a loved cuisine", () => {
    const aff = buildTokenAffinity([rf({ cuisines: ["Mexican"], ratings: { a: 9 } })]);
    const catalog = [
      ce({ id: "m", name: "Taqueria", cuisines: ["Mexican & Tex-Mex"] }), // token mexican -> match
      ce({ id: "s", name: "Sushi Bar", cuisines: ["Japanese & Sushi"] }), // no affinity
      ce({ id: "t", name: "Tracked Mex", cuisines: ["Mexican & Tex-Mex"], tracked: true }),
    ];
    const picks = recommendFromCatalog(catalog, aff);
    expect(picks.map((p) => p.entry.id)).toEqual(["m"]); // not s (no affinity), not t (tracked)
    expect(picks[0].via).toBe("Mexican & Tex-Mex");
  });

  it("returns nothing when the family has no ratings", () => {
    expect(recommendFromCatalog([ce({ cuisines: ["Mexican & Tex-Mex"] })], new Map())).toEqual([]);
  });
});

describe("neighborhoods", () => {
  it("extracts the neighborhood from an address", () => {
    expect(neighborhoodOf("Riverside, Austin, TX")).toBe("Riverside");
    expect(neighborhoodOf(null)).toBeNull();
  });
  it("lists unique sorted neighborhoods", () => {
    const list = catalogNeighborhoods([
      ce({ address: "Riverside, Austin, TX" }),
      ce({ address: "Mueller, Austin, TX" }),
      ce({ address: "Riverside, Austin, TX" }),
    ]);
    expect(list).toEqual(["Mueller", "Riverside"]);
  });
});
