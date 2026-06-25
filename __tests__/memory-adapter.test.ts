import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_HOUSEHOLD_ID, MemoryAdapter, MemoryRegistry } from "../lib/data/memory";
import { NewRestaurant } from "../lib/data/adapter";

function freshStore() {
  // reset the module-global demo store between tests
  (globalThis as unknown as { __ffStore?: unknown }).__ffStore = undefined;
}

function newRestaurant(over: Partial<NewRestaurant> = {}): NewRestaurant {
  return {
    name: "Test",
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
    ...over,
  };
}

describe("MemoryAdapter.mergeRestaurants", () => {
  beforeEach(freshStore);

  it("moves visits, adopts missing ratings, unions cuisines, removes the loser", async () => {
    const db = new MemoryAdapter(DEMO_HOUSEHOLD_ID);
    const [mom] = await db.listProfiles();
    const survivor = await db.createRestaurant(newRestaurant({ name: "Joe's", cuisines: ["Pizza"] }));
    const loser = await db.createRestaurant(
      newRestaurant({ name: "Joe's Pizza", cuisines: ["Italian"], tags: ["patio"] })
    );

    await db.setRating(loser.id, mom.id, 9);
    await db.addVisit(loser.id, new Date().toISOString(), "dine_in", null);

    await db.mergeRestaurants(survivor.id, loser.id);

    expect(await db.getRestaurant(loser.id)).toBeNull();
    const merged = await db.getRestaurant(survivor.id);
    expect(merged).not.toBeNull();
    expect(merged!.cuisines.sort()).toEqual(["Italian", "Pizza"]);
    expect(merged!.tags).toContain("patio");
    expect(merged!.visitCount).toBe(1); // visit moved over
    expect(merged!.ratings[mom.id]).toBe(9); // rating adopted
  });

  it("keeps the survivor's rating when both rated the same profile", async () => {
    const db = new MemoryAdapter(DEMO_HOUSEHOLD_ID);
    const [mom] = await db.listProfiles();
    const survivor = await db.createRestaurant(newRestaurant({ name: "A" }));
    const loser = await db.createRestaurant(newRestaurant({ name: "A2" }));
    await db.setRating(survivor.id, mom.id, 10);
    await db.setRating(loser.id, mom.id, 2);

    await db.mergeRestaurants(survivor.id, loser.id);

    const merged = await db.getRestaurant(survivor.id);
    expect(merged!.ratings[mom.id]).toBe(10);
  });
});

describe("MemoryAdapter vote deferral + credits", () => {
  beforeEach(freshStore);

  it("stores a deferred vote and double credits", async () => {
    const db = new MemoryAdapter(DEMO_HOUSEHOLD_ID);
    const [mom] = await db.listProfiles();
    const session = await db.createVoteSession(["a", "b"]);

    await db.castVote(session.id, mom.id, null, null, true);
    const votes = await db.listVotes(session.id);
    expect(votes[0].deferred).toBe(true);

    await db.setDoubleCredits(mom.id, 1);
    const refreshed = (await db.listProfiles()).find((p) => p.id === mom.id);
    expect(refreshed!.doubleCredits).toBe(1);

    // never goes negative
    await db.setDoubleCredits(mom.id, -5);
    const again = (await db.listProfiles()).find((p) => p.id === mom.id);
    expect(again!.doubleCredits).toBe(0);
  });
});

describe("MemoryAdapter.clearWishlist", () => {
  beforeEach(freshStore);

  it("removes only this group's wishlist, leaving active places", async () => {
    const db = new MemoryAdapter(DEMO_HOUSEHOLD_ID);
    await db.createRestaurant(newRestaurant({ name: "Want A", status: "wishlist" }));
    await db.createRestaurant(newRestaurant({ name: "Want B", status: "wishlist" }));
    const before = await db.listRestaurants();
    const activeBefore = before.filter((r) => r.status === "active").length;
    const wishBefore = before.filter((r) => r.status === "wishlist").length;
    expect(wishBefore).toBeGreaterThanOrEqual(2);

    const removed = await db.clearWishlist();
    expect(removed).toBe(wishBefore);

    const after = await db.listRestaurants();
    expect(after.filter((r) => r.status === "wishlist")).toHaveLength(0);
    expect(after.filter((r) => r.status === "active")).toHaveLength(activeBefore);
  });
});

describe("MemoryAdapter master catalog", () => {
  beforeEach(freshStore);

  it("lists the shared catalog flagged with what this group tracks", async () => {
    const other = await new MemoryRegistry().createHousehold("Cousins", "hash");
    const a = new MemoryAdapter(DEMO_HOUSEHOLD_ID);
    const b = new MemoryAdapter(other.id);

    // group B starts tracking nothing, but sees the shared catalog
    const catalogB = await b.listCatalog();
    expect(catalogB.length).toBeGreaterThan(0);
    expect(catalogB.every((c) => !c.tracked)).toBe(true);

    // tracking one adds it to B's list without affecting A
    const target = catalogB[0];
    const brandId = await b.trackRestaurant(target.id, "wishlist");
    expect((await b.listRestaurants()).some((r) => r.id === brandId)).toBe(true);
    const flagged = (await b.listCatalog()).find((c) => c.id === target.id);
    expect(flagged?.tracked).toBe(true);
    expect(flagged?.trackedStatus).toBe("wishlist");

    // A's catalog still shows it as tracked (A had the demo seed) or not, but
    // B tracking it didn't change A's tracked set size
    const aTracked = (await a.listCatalog()).filter((c) => c.tracked).length;
    expect(aTracked).toBeGreaterThan(0);
  });
});

describe("per-family cuisine overrides", () => {
  beforeEach(freshStore);

  it("applies a group's cuisine override without touching the shared catalog", async () => {
    const a = new MemoryAdapter(DEMO_HOUSEHOLD_ID);
    const other = await new MemoryRegistry().createHousehold("Cousins", "h");
    const b = new MemoryAdapter(other.id);

    const made = await a.createRestaurant(newRestaurant({ name: "Shared Spot", cuisines: ["American"] }));
    const loc = (await a.listCatalog()).find((c) => c.name === "Shared Spot")!;
    await b.trackRestaurant(loc.id, "active"); // B tracks the shared catalog location

    // group A overrides the cuisine for its own brand
    const settings = await a.getSettings();
    await a.saveSettings({ ...settings, cuisineOverrides: { [made.id]: ["BBQ", "Tacos"] } });

    const inA = (await a.listRestaurants()).find((r) => r.id === made.id);
    const inB = (await b.listRestaurants()).find((r) => r.name === "Shared Spot");
    expect(inA?.cuisines).toEqual(["BBQ", "Tacos"]); // A sees its override
    expect(inB?.cuisines).toEqual(["American"]); // B still sees the catalog value
  });
});

describe("multi-group isolation", () => {
  beforeEach(freshStore);

  it("a new group sees none of another group's data", async () => {
    const other = await new MemoryRegistry().createHousehold("Cousins", "hash");
    const a = new MemoryAdapter(DEMO_HOUSEHOLD_ID);
    const b = new MemoryAdapter(other.id);

    expect((await a.listRestaurants()).length).toBeGreaterThan(0);
    expect(await b.listRestaurants()).toEqual([]);
    expect(await b.listProfiles()).toEqual([]);

    await b.createProfile("Cuz", "🦝", "#fff");
    const made = await b.createRestaurant(newRestaurant({ name: "B-only Diner" }));
    expect((await a.listRestaurants()).some((r) => r.id === made.id)).toBe(false);
    expect((await b.listRestaurants()).some((r) => r.id === made.id)).toBe(true);
    // A's profiles are unchanged by B adding one
    expect((await a.listProfiles()).every((p) => p.name !== "Cuz")).toBe(true);
  });

  it("shares the catalog: the same place added by two groups reuses one catalog row", async () => {
    const other = await new MemoryRegistry().createHousehold("Cousins", "hash");
    const a = new MemoryAdapter(DEMO_HOUSEHOLD_ID);
    const b = new MemoryAdapter(other.id);

    const ra = await a.createRestaurant(newRestaurant({ name: "Shared Spot", googlePlaceId: "PIDX" }));
    const rb = await b.createRestaurant(
      newRestaurant({ name: "Shared Spot", googlePlaceId: "PIDX", status: "wishlist" })
    );
    // each household gets its own brand, but they share one catalog row
    const catA = (await a.listCatalog()).find((c) => c.name === "Shared Spot");
    const catB = (await b.listCatalog()).find((c) => c.name === "Shared Spot");
    expect(catA?.id).toBe(catB?.id); // deduped to the same catalog entry

    // and each group tracks it with its own status
    const inA = (await a.listRestaurants()).find((r) => r.id === ra.id);
    const inB = (await b.listRestaurants()).find((r) => r.id === rb.id);
    expect(inA?.status).toBe("active");
    expect(inB?.status).toBe("wishlist");
  });
});

describe("brand grouping", () => {
  beforeEach(freshStore);

  it("groups same-named locations into one brand entry", async () => {
    const other = await new MemoryRegistry().createHousehold("Fam", "h");
    const db = new MemoryAdapter(other.id);
    const p = await db.createProfile("Kid", "🦊", "#fff");

    const b1 = await db.createRestaurant(newRestaurant({ name: "Chick-fil-A", googlePlaceId: "L1", cuisines: ["Fast Food"] }));
    const b2 = await db.createRestaurant(newRestaurant({ name: "Chick-fil-A", googlePlaceId: "L2" }));
    expect(b2.id).toBe(b1.id); // both locations land on the same brand

    const cfa = (await db.listRestaurants()).filter((r) => r.name === "Chick-fil-A");
    expect(cfa).toHaveLength(1);
    expect(cfa[0].locationCount).toBe(2);

    // ratings are brand-wide
    await db.setRating(cfa[0].id, p.id, 8);
    const after = (await db.listRestaurants()).find((r) => r.id === cfa[0].id)!;
    expect(after.ratings[p.id]).toBe(8);
  });

  it("merging two brands keeps the highest rating per person and pools locations", async () => {
    const other = await new MemoryRegistry().createHousehold("Fam2", "h");
    const db = new MemoryAdapter(other.id);
    const p = await db.createProfile("Kid", "🦊", "#fff");
    const a = await db.createRestaurant(newRestaurant({ name: "Pizza One" }));
    const b = await db.createRestaurant(newRestaurant({ name: "Pizza Two" }));
    await db.setRating(a.id, p.id, 6);
    await db.setRating(b.id, p.id, 9);

    await db.mergeRestaurants(a.id, b.id);
    const merged = await db.getRestaurant(a.id);
    expect(merged!.ratings[p.id]).toBe(9); // highest wins
    expect(merged!.locationCount).toBe(2);
    expect(await db.getRestaurant(b.id)).toBeNull();
  });

  it("splits one location out into its own brand", async () => {
    const other = await new MemoryRegistry().createHousehold("Fam3", "h");
    const db = new MemoryAdapter(other.id);
    await db.createRestaurant(newRestaurant({ name: "Subway", googlePlaceId: "S1" }));
    await db.createRestaurant(newRestaurant({ name: "Subway", googlePlaceId: "S2" }));
    const brand = (await db.listRestaurants()).find((r) => r.name === "Subway")!;
    expect(brand.locationCount).toBe(2);

    const newId = await db.splitLocation(brand.id, brand.locations[0].id);
    expect(newId).not.toBe(brand.id);
    const subs = (await db.listRestaurants()).filter((r) => r.name === "Subway");
    expect(subs).toHaveLength(2);
    expect(subs.every((s) => s.locationCount === 1)).toBe(true);
  });

  it("editing an address updates coords but never reassigns the place id", async () => {
    const other = await new MemoryRegistry().createHousehold("Fam4", "h");
    const db = new MemoryAdapter(other.id);
    const brand = await db.createRestaurant(
      newRestaurant({ name: "Cafe", googlePlaceId: "ORIG", address: "1 Old St", lat: 30.1, lng: -97.1 })
    );
    // an address edit (autocomplete would submit a NEW place id) must not change identity
    await db.updateRestaurant(brand.id, {
      name: "Cafe", cuisines: [], price: 2, address: "2 New Ave", lat: 30.5, lng: -97.5,
      googlePlaceId: "DIFFERENT", mapsUrl: null, reserveUrl: null, tags: [], status: "active", notes: null,
    });
    const after = (await db.getRestaurant(brand.id))!;
    expect(after.locations[0].address).toBe("2 New Ave");
    expect(after.locations[0].lat).toBe(30.5);
    expect(after.locations[0].googlePlaceId).toBe("ORIG"); // identity preserved
  });
});
