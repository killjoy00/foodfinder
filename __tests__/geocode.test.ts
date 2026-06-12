import { describe, expect, it } from "vitest";
import { parseZippopotam } from "../lib/geocode";

describe("parseZippopotam", () => {
  it("parses a standard US ZIP response", () => {
    const result = parseZippopotam({
      "post code": "90210",
      country: "United States",
      places: [
        {
          "place name": "Beverly Hills",
          state: "California",
          "state abbreviation": "CA",
          latitude: "34.0901",
          longitude: "-118.4065",
        },
      ],
    });
    expect(result).toEqual({ lat: 34.0901, lng: -118.4065, label: "Beverly Hills, CA" });
  });

  it("returns null for unknown ZIPs and malformed data", () => {
    expect(parseZippopotam({})).toBeNull();
    expect(parseZippopotam({ places: [] })).toBeNull();
    expect(parseZippopotam({ places: [{ latitude: "not-a-number", longitude: "1" }] })).toBeNull();
  });
});
