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
  const base = { name: "X", address: null, mapsUrl: null, googlePlaceId: null, lat: null, lng: null };

  it("prefers the place id (most reliable) over a stored url", () => {
    const url = mapsLink({
      ...base,
      name: "Taco Spot",
      address: "1 A St",
      mapsUrl: "https://maps.app/x",
      googlePlaceId: "PID",
    });
    expect(url).toContain("query_place_id=PID");
    expect(url).toContain("Taco");
  });

  it("falls back to coordinates, then stored url, then a text search", () => {
    expect(mapsLink({ ...base, lat: 30.27, lng: -97.74 })).toContain("query=30.27%2C-97.74");
    expect(mapsLink({ ...base, mapsUrl: "https://maps.app/x" })).toBe("https://maps.app/x");
    expect(mapsLink({ ...base, name: "Y", address: "Z" })).toContain("query=Y%20Z");
  });
});
