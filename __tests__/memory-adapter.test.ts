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
    expect(rb.id).toBe(ra.id); // deduped to the same catalog entry

    // but each group tracks it with its own status
    const inA = (await a.listRestaurants()).find((r) => r.id === ra.id);
    const inB = (await b.listRestaurants()).find((r) => r.id === ra.id);
    expect(inA?.status).toBe("active");
    expect(inB?.status).toBe("wishlist");
  });
});
