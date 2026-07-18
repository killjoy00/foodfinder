import { describe, expect, it } from "vitest";
import { brandKey, planBrandAssignments } from "../lib/brand";

describe("planBrandAssignments", () => {
  it("creates one brand per normalized name and assigns every location", () => {
    const plan = planBrandAssignments(
      [
        { id: "r1", name: "Chick-fil-A" },
        { id: "r2", name: "Chick Fil A" },
        { id: "r3", name: "Taqueria Luna" },
      ],
      new Set()
    );
    expect(plan.newBrands).toEqual([
      { key: brandKey("Chick-fil-A"), name: "Chick-fil-A" },
      { key: brandKey("Taqueria Luna"), name: "Taqueria Luna" },
    ]);
    expect(plan.assignments).toHaveLength(3);
    expect(plan.assignments[0].key).toBe(plan.assignments[1].key);
  });

  it("reuses existing brands instead of planning new ones", () => {
    const key = brandKey("Taqueria Luna");
    const plan = planBrandAssignments([{ id: "r1", name: "Taqueria Luna" }], new Set([key]));
    expect(plan.newBrands).toEqual([]);
    expect(plan.assignments).toEqual([{ restaurantId: "r1", key }]);
  });

  it("keeps the first name for a duplicated brand (matching ensureBrand)", () => {
    const plan = planBrandAssignments(
      [
        { id: "r1", name: "P. Terry's" },
        { id: "r2", name: "P Terrys" },
      ],
      new Set()
    );
    expect(plan.newBrands).toEqual([{ key: brandKey("P. Terry's"), name: "P. Terry's" }]);
  });

  it("skips entries whose name normalizes to nothing", () => {
    const plan = planBrandAssignments([{ id: "r1", name: "!!!" }], new Set());
    expect(plan.newBrands).toEqual([]);
    expect(plan.assignments).toEqual([]);
  });
});
