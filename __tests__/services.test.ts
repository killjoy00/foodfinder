import { beforeEach, describe, expect, it } from "vitest";
import { NewRestaurant } from "../lib/data/adapter";
import { DEMO_HOUSEHOLD_ID, MemoryAdapter } from "../lib/data/memory";
import {
  castVote,
  closeVote,
  logVisit,
  normalizeRestaurantInput,
  startQuickVote,
} from "../lib/services";

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

describe("logVisit", () => {
  beforeEach(freshStore);

  it("records the visit and promotes a wishlist place to active", async () => {
    const db = new MemoryAdapter(DEMO_HOUSEHOLD_ID);
    const wish = await db.createRestaurant(newRestaurant({ name: "Someday", status: "wishlist" }));

    await logVisit(db, wish.id, "dine_in", "  first try!  ");

    const after = await db.getRestaurant(wish.id);
    expect(after?.status).toBe("active");
    const visits = await db.listVisitsForRestaurant(wish.id);
    expect(visits).toHaveLength(1);
    expect(visits[0].note).toBe("first try!");
  });

  it("stores an empty note as null", async () => {
    const db = new MemoryAdapter(DEMO_HOUSEHOLD_ID);
    const place = await db.createRestaurant(newRestaurant({ name: "Regular" }));
    await logVisit(db, place.id, "takeout", "   ");
    const visits = await db.listVisitsForRestaurant(place.id);
    expect(visits[0].note).toBeNull();
    expect(visits[0].mode).toBe("takeout");
  });
});

describe("quick vote + cast + close", () => {
  beforeEach(freshStore);

  it("runs a full vote round through the services", async () => {
    const db = new MemoryAdapter(DEMO_HOUSEHOLD_ID);
    const profiles = await db.listProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(2);
    const [a, b] = profiles;

    const session = await startQuickVote(db, 4);
    expect(session).not.toBeNull();
    expect(session!.candidateIds.length).toBeGreaterThanOrEqual(2);
    expect(session!.candidateIds.length).toBeLessThanOrEqual(4);

    const [first, second] = session!.candidateIds;
    await castVote(db, a.id, session!.id, first, null, false);
    await castVote(db, b.id, session!.id, second ?? first, null, false);
    expect(await db.listVotes(session!.id)).toHaveLength(2);

    await closeVote(db, session!.id);
    const closed = await db.getVoteSession(session!.id);
    expect(closed?.status).toBe("closed");
    expect(closed?.winnerId).not.toBeNull();
    expect(session!.candidateIds).toContain(closed!.winnerId);
  });

  it("banks a double credit on deferral and spends it on the next pick", async () => {
    const db = new MemoryAdapter(DEMO_HOUSEHOLD_ID);
    const [a] = await db.listProfiles();

    const round1 = await startQuickVote(db, 3);
    await castVote(db, a.id, round1!.id, null, null, true); // sit out, bank credit
    // deferral is final — a later cast in the same round is ignored
    await castVote(db, a.id, round1!.id, round1!.candidateIds[0], null, false);
    const votes1 = await db.listVotes(round1!.id);
    expect(votes1).toHaveLength(1);
    expect(votes1[0].deferred).toBe(true);
    await closeVote(db, round1!.id);
    expect((await db.listProfiles()).find((p) => p.id === a.id)?.doubleCredits).toBe(1);

    const round2 = await startQuickVote(db, 3);
    await castVote(db, a.id, round2!.id, round2!.candidateIds[0], null, false);
    await closeVote(db, round2!.id);
    expect((await db.listProfiles()).find((p) => p.id === a.id)?.doubleCredits).toBe(0);
  });

  it("refuses a ballot whose pick and veto match", async () => {
    const db = new MemoryAdapter(DEMO_HOUSEHOLD_ID);
    const [a] = await db.listProfiles();
    const session = await startQuickVote(db, 3);
    const target = session!.candidateIds[0];
    await castVote(db, a.id, session!.id, target, target, false);
    expect(await db.listVotes(session!.id)).toHaveLength(0);
  });
});

describe("normalizeRestaurantInput", () => {
  it("cleans and clamps an untrusted payload", () => {
    const data = normalizeRestaurantInput({
      name: "  Thai Cottage  ",
      cuisines: [" Thai ", ""],
      price: 99,
      address: "  ",
      lat: Number.NaN,
      lng: 30.2,
      tags: ["patio", " "],
      status: "wishlist",
      notes: "",
    });
    expect(data.name).toBe("Thai Cottage");
    expect(data.cuisines).toEqual(["Thai"]);
    expect(data.price).toBe(4);
    expect(data.address).toBeNull();
    expect(data.lat).toBeNull();
    expect(data.lng).toBe(30.2);
    expect(data.tags).toEqual(["patio"]);
    expect(data.status).toBe("wishlist");
    expect(data.notes).toBeNull();
  });

  it("defaults a missing payload to a safe active entry", () => {
    const data = normalizeRestaurantInput({});
    expect(data.name).toBe("");
    expect(data.price).toBe(2);
    expect(data.status).toBe("active");
  });
});
