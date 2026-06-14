import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  buildCandidates,
  buildCuisineRecency,
  eaterScore,
  passesFilters,
  pickTonight,
  pickWeighted,
  sampleCandidates,
  weighCandidate,
  wheelSegments,
} from "../lib/picker";
import { RestaurantFull } from "../lib/types";

function restaurant(overrides: Partial<RestaurantFull> = {}): RestaurantFull {
  return {
    id: "r1",
    name: "Test Place",
    cuisines: ["Mexican"],
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

const NOW = new Date("2026-06-12T00:00:00Z");

function isoDaysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 86_400_000).toISOString();
}

describe("eaterScore", () => {
  it("averages selected eaters, defaulting unrated eaters to 5", () => {
    const r = restaurant({ ratings: { a: 9, b: 7 } });
    expect(eaterScore(r, ["a", "b"])).toBe(8);
    expect(eaterScore(r, ["a", "c"])).toBe(7); // c unrated -> 5
  });

  it("falls back to all raters when no eaters selected", () => {
    expect(eaterScore(restaurant({ ratings: { a: 10, b: 6 } }), [])).toBe(8);
    expect(eaterScore(restaurant(), [])).toBe(5);
  });
});

describe("buildCuisineRecency", () => {
  it("maps each cuisine to the fewest days since it was eaten", () => {
    const cuisines = new Map([
      ["a", ["BBQ"]],
      ["b", ["BBQ", "American"]],
    ]);
    const recency = buildCuisineRecency(
      [
        { restaurantId: "a", date: isoDaysAgo(1) },
        { restaurantId: "b", date: isoDaysAgo(5) },
      ],
      cuisines,
      NOW
    );
    expect(recency.bbq).toBe(1); // most recent BBQ wins
    expect(recency.american).toBe(5);
  });
});

describe("passesFilters", () => {
  it("filters by price, cuisine, tags, and exclusions", () => {
    const r = restaurant({ price: 3, cuisines: ["Italian"], tags: ["patio"] });
    expect(passesFilters(r, { ...DEFAULT_FILTERS, maxPrice: 2 })).toBe(false);
    expect(passesFilters(r, { ...DEFAULT_FILTERS, cuisines: ["italian"] })).toBe(true);
    expect(passesFilters(r, { ...DEFAULT_FILTERS, cuisines: ["Thai"] })).toBe(false);
    expect(passesFilters(r, { ...DEFAULT_FILTERS, tags: ["patio"] })).toBe(true);
    expect(passesFilters(r, { ...DEFAULT_FILTERS, tags: ["kid_friendly"] })).toBe(false);
    expect(passesFilters(r, { ...DEFAULT_FILTERS, excludeIds: ["r1"] })).toBe(false);
  });

  it("requires the takeout tag in takeout mode only for tagged restaurants", () => {
    const tagged = restaurant({ tags: ["patio"] });
    const untagged = restaurant({ tags: [] });
    const takeout = { ...DEFAULT_FILTERS, mode: "takeout" as const };
    expect(passesFilters(tagged, takeout)).toBe(false);
    expect(passesFilters(untagged, takeout)).toBe(true);
  });

  it("hides special cuisines unless chosen, including a combined label", () => {
    const normal = restaurant({ cuisines: ["Mexican"] });
    for (const special of ["Dessert", "Coffee", "Tea", "Coffee/Tea"]) {
      const r = restaurant({ cuisines: [special] });
      // default: hidden, normal shown
      expect(passesFilters(r, DEFAULT_FILTERS)).toBe(false);
      // selected: shown, and normal excluded by the cuisine filter
      const want = { ...DEFAULT_FILTERS, cuisines: [special] };
      expect(passesFilters(r, want)).toBe(true);
      expect(passesFilters(normal, want)).toBe(false);
    }
    // a normal cuisine that merely contains the letters of a keyword is not special
    expect(passesFilters(restaurant({ cuisines: ["Steak"] }), DEFAULT_FILTERS)).toBe(true);
  });
});

describe("quality bar (minScore)", () => {
  it("excludes places nobody rates at or above the bar", () => {
    const dud = restaurant({ ratings: { a: 3, b: 4 } });
    expect(passesFilters(dud, { ...DEFAULT_FILTERS, minScore: 5 })).toBe(false);
  });

  it("passes if at least one family member likes it", () => {
    const split = restaurant({ ratings: { a: 3, b: 8 } });
    expect(passesFilters(split, { ...DEFAULT_FILTERS, minScore: 5 })).toBe(true);
    expect(passesFilters(split, { ...DEFAULT_FILTERS, minScore: 9 })).toBe(false);
  });

  it("keeps unrated places (wishlist) eligible", () => {
    expect(passesFilters(restaurant({ ratings: {} }), { ...DEFAULT_FILTERS, minScore: 8 })).toBe(true);
  });

  it("minScore 0 turns the bar off", () => {
    const dud = restaurant({ ratings: { a: 1 } });
    expect(passesFilters(dud, { ...DEFAULT_FILTERS, minScore: 0 })).toBe(true);
  });
});

describe("weighCandidate", () => {
  it("down-weights places visited recently", () => {
    const recent = weighCandidate(restaurant({ lastVisitAt: isoDaysAgo(1) }), DEFAULT_FILTERS, {}, NOW);
    const stale = weighCandidate(restaurant({ lastVisitAt: isoDaysAgo(90) }), DEFAULT_FILTERS, {}, NOW);
    expect(stale.weight).toBeGreaterThan(recent.weight * 1.8);
    expect(stale.reasons.join(" ")).toContain("haven't been");
  });

  it("down-weights recently eaten cuisines, recovering over time", () => {
    const base = weighCandidate(restaurant(), DEFAULT_FILTERS, {}, NOW);
    const justHad = weighCandidate(restaurant(), DEFAULT_FILTERS, { mexican: 0 }, NOW);
    const weekAgo = weighCandidate(restaurant(), DEFAULT_FILTERS, { mexican: 7 }, NOW);
    expect(justHad.weight).toBeLessThan(weekAgo.weight);
    expect(weekAgo.weight).toBeLessThan(base.weight);
  });

  it("removes the cuisine penalty when that cuisine is explicitly chosen", () => {
    const filters = { ...DEFAULT_FILTERS, cuisines: ["Mexican"] };
    const chosen = weighCandidate(restaurant(), filters, { mexican: 0 }, NOW);
    const notChosen = weighCandidate(restaurant(), DEFAULT_FILTERS, { mexican: 0 }, NOW);
    expect(chosen.weight).toBeGreaterThan(notChosen.weight);
  });

  it("recencyStrength 0 ignores recency entirely", () => {
    const f = { ...DEFAULT_FILTERS, recencyStrength: 0 };
    const recent = weighCandidate(restaurant({ lastVisitAt: isoDaysAgo(1) }), f, { mexican: 0 }, NOW);
    const stale = weighCandidate(restaurant({ lastVisitAt: isoDaysAgo(90) }), f, {}, NOW);
    expect(recent.weight).toBeCloseTo(stale.weight);
  });

  it("weights higher-rated places more", () => {
    const loved = weighCandidate(restaurant({ ratings: { a: 10 } }), { ...DEFAULT_FILTERS, eaterIds: ["a"] }, {}, NOW);
    const meh = weighCandidate(restaurant({ ratings: { a: 4 } }), { ...DEFAULT_FILTERS, eaterIds: ["a"] }, {}, NOW);
    expect(loved.weight).toBeGreaterThan(meh.weight * 5);
  });
});

describe("pickWeighted", () => {
  it("returns null for empty input", () => {
    expect(pickWeighted([])).toBeNull();
  });

  it("respects weights deterministically", () => {
    const items = [
      { id: "low", weight: 1 },
      { id: "high", weight: 9 },
    ];
    expect(pickWeighted(items, () => 0.05)?.id).toBe("low");
    expect(pickWeighted(items, () => 0.5)?.id).toBe("high");
  });
});

describe("pickTonight", () => {
  const pool = [
    restaurant({ id: "a", name: "A", status: "active", lastVisitAt: isoDaysAgo(10) }),
    restaurant({ id: "b", name: "B", status: "active", lastVisitAt: isoDaysAgo(40) }),
    restaurant({ id: "w", name: "W", status: "wishlist", cuisines: ["Thai"] }),
  ];

  it("picks from the wishlist when the wishlist die hits", () => {
    const rolls = [0.1, 0.5];
    let i = 0;
    const rng = () => rolls[i++ % rolls.length];
    const picked = pickTonight(pool, { ...DEFAULT_FILTERS, wishlistPercent: 50 }, {}, rng, NOW);
    expect(picked?.restaurant.id).toBe("w");
  });

  it("never picks wishlist at 0%", () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = () => ((seed * 9301 + 49297) % 233280) / 233280;
      const picked = pickTonight(pool, { ...DEFAULT_FILTERS, wishlistPercent: 0 }, {}, rng, NOW);
      expect(picked?.restaurant.status).toBe("active");
    }
  });

  it("falls back to regulars when filters empty the wishlist", () => {
    const picked = pickTonight(
      pool,
      { ...DEFAULT_FILTERS, wishlistPercent: 100, cuisines: ["Mexican"] },
      {},
      () => 0.01,
      NOW
    );
    expect(picked?.restaurant.status).toBe("active");
  });

  it("returns null when nothing matches", () => {
    expect(
      pickTonight(pool, { ...DEFAULT_FILTERS, cuisines: ["Ethiopian"] }, {}, Math.random, NOW)
    ).toBeNull();
  });
});

describe("sampleCandidates", () => {
  const pool = buildCandidates(
    Array.from({ length: 10 }, (_, i) => restaurant({ id: `r${i}`, name: `R${i}` })),
    DEFAULT_FILTERS,
    {},
    NOW
  ).regulars;

  it("returns the requested number of distinct candidates", () => {
    const sampled = sampleCandidates(pool, 4, () => 0.42);
    expect(sampled).toHaveLength(4);
    expect(new Set(sampled.map((c) => c.restaurant.id)).size).toBe(4);
  });

  it("caps at the pool size and skips zero-weight candidates", () => {
    const tiny = sampleCandidates(pool.slice(0, 2), 6);
    expect(tiny).toHaveLength(2);
    const zeroed = pool.map((c) => ({ ...c, weight: 0 }));
    expect(sampleCandidates(zeroed, 3)).toHaveLength(0);
  });
});

describe("wheelSegments", () => {
  it("always contains the winner and caps the size", () => {
    const all = buildCandidates(
      Array.from({ length: 15 }, (_, i) => restaurant({ id: `r${i}`, name: `R${i}` })),
      DEFAULT_FILTERS,
      {},
      NOW
    ).regulars;
    const winner = all[7];
    const segments = wheelSegments(winner, all, 8, () => 0.4);
    expect(segments).toHaveLength(8);
    expect(segments.some((s) => s.restaurant.id === winner.restaurant.id)).toBe(true);
  });
});
