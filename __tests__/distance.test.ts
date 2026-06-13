import { describe, expect, it } from "vitest";
import { distanceMiles, formatMiles, haversineMiles } from "../lib/distance";

describe("haversineMiles", () => {
  it("computes a known distance (SF to LA ~ 347 mi)", () => {
    const d = haversineMiles(37.7749, -122.4194, 34.0522, -118.2437);
    expect(d).toBeGreaterThan(340);
    expect(d).toBeLessThan(355);
  });

  it("is zero for the same point", () => {
    expect(haversineMiles(40, -100, 40, -100)).toBeCloseTo(0);
  });
});

describe("distanceMiles", () => {
  it("returns null when either side lacks coordinates", () => {
    expect(distanceMiles(null, { lat: 1, lng: 1 })).toBeNull();
    expect(distanceMiles({ lat: 1, lng: 1 }, { lat: null, lng: null })).toBeNull();
    expect(distanceMiles({ lat: null, lng: 2 }, { lat: 1, lng: 1 })).toBeNull();
  });

  it("computes when both have coordinates", () => {
    expect(distanceMiles({ lat: 37.7749, lng: -122.4194 }, { lat: 37.8, lng: -122.4 })).toBeLessThan(
      5
    );
  });
});

describe("formatMiles", () => {
  it("formats under 10 with one decimal and 10+ as whole", () => {
    expect(formatMiles(0.34)).toBe("0.3 mi");
    expect(formatMiles(2.45)).toBe("2.5 mi");
    expect(formatMiles(12.6)).toBe("13 mi");
    expect(formatMiles(null)).toBeNull();
  });
});
