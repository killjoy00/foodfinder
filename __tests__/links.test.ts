import { describe, expect, it } from "vitest";
import { mapsLink, openTableLink } from "../lib/types";

const base = {
  name: "Pasta Fresca",
  reserveUrl: null,
  lat: null,
  lng: null,
  address: null,
};

describe("openTableLink", () => {
  it("prefers an explicit reservation URL when set", () => {
    expect(openTableLink({ ...base, reserveUrl: "https://resy.com/x" })).toBe("https://resy.com/x");
  });

  it("biases the search by lat/long when coordinates are known", () => {
    const url = new URL(openTableLink({ ...base, lat: 37.7749, lng: -122.4194 }));
    expect(url.searchParams.get("term")).toBe("Pasta Fresca");
    expect(url.searchParams.get("latitude")).toBe("37.7749");
    expect(url.searchParams.get("longitude")).toBe("-122.4194");
  });

  it("folds the address into the term when there are no coordinates", () => {
    const url = new URL(openTableLink({ ...base, address: "100 Mission St, San Francisco" }));
    expect(url.searchParams.get("term")).toBe("Pasta Fresca 100 Mission St, San Francisco");
    expect(url.searchParams.get("latitude")).toBeNull();
  });
});

describe("mapsLink", () => {
  it("uses the stored maps url when present", () => {
    expect(
      mapsLink({ name: "X", address: null, mapsUrl: "https://maps.app/x", googlePlaceId: null })
    ).toBe("https://maps.app/x");
  });

  it("builds a place-id query when available", () => {
    const url = mapsLink({ name: "Taco Spot", address: "1 A St", mapsUrl: null, googlePlaceId: "PID" });
    expect(url).toContain("query_place_id=PID");
    expect(url).toContain("Taco");
  });
});
