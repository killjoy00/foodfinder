import { describe, expect, it } from "vitest";
import { ratingStats } from "../lib/ratings";

describe("ratingStats", () => {
  it("returns zeros when nobody has rated", () => {
    const s = ratingStats({});
    expect(s.count).toBe(0);
    expect(s.mean).toBe(0);
    expect(s.consensus).toBe(0);
    expect(s.divisive).toBe(false);
  });

  it("reports mean, count, and spread", () => {
    const s = ratingStats({ a: 8, b: 4 });
    expect(s.mean).toBe(6);
    expect(s.count).toBe(2);
    expect(s.spread).toBe(4);
  });

  it("rewards broad agreement over a single high rating", () => {
    const lone = ratingStats({ a: 10 });
    const everyone = ratingStats({ a: 9, b: 9, c: 9 });
    expect(everyone.consensus).toBeGreaterThan(lone.consensus);
  });

  it("penalizes a divisive split versus calm agreement at the same mean", () => {
    const split = ratingStats({ a: 10, b: 2 }); // mean 6, but contentious
    const agreed = ratingStats({ a: 6, b: 6 }); // mean 6, everyone aligned
    expect(agreed.consensus).toBeGreaterThan(split.consensus);
    expect(split.divisive).toBe(true);
    expect(agreed.divisive).toBe(false);
  });
});
