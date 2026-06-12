import { describe, expect, it } from "vitest";
import { parseTakeout, parseTakeoutAny, parseTakeoutCsv, starToScore } from "../lib/takeout";

const SAVED_PLACES = JSON.stringify({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-122.4194, 37.7749] },
      properties: {
        date: "2024-03-01T18:00:00Z",
        google_maps_url: "http://maps.google.com/?cid=123456",
        location: {
          address: "100 Mission St, San Francisco, CA",
          country_code: "US",
          name: "Taqueria El Sol",
        },
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-122.41, 37.77] },
      properties: {
        google_maps_url: "http://maps.google.com/?cid=999",
        location: { name: "Duplicate-Free Cafe", address: "1 Main St" },
      },
    },
    {
      // duplicate of the one above (same name + address)
      type: "Feature",
      properties: {
        location: { name: "Duplicate-Free Cafe", address: "1 Main St" },
      },
    },
  ],
});

const REVIEWS = JSON.stringify({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-122.4, 37.78] },
      properties: {
        five_star_rating_published: 4,
        review_text_published: "Great noodles",
        date: "2023-11-12T01:00:00Z",
        google_maps_url: "https://www.google.com/maps/place/?q=place_id:ChIJabc123_-XYZ",
        location: { address: "200 Grant Ave", name: "Noodle Palace" },
      },
    },
    {
      type: "Feature",
      properties: {
        // older Takeout export style
        "Star Rating": 5,
        "Google Maps URL": "https://maps.google.com/?cid=42",
        Location: { "Business Name": "Old Format Diner", Address: "3 Elm St" },
      },
    },
  ],
});

describe("parseTakeout", () => {
  it("parses saved places with coordinates and urls", () => {
    const items = parseTakeout(SAVED_PLACES);
    expect(items).toHaveLength(2); // duplicate removed
    const [first] = items;
    expect(first.name).toBe("Taqueria El Sol");
    expect(first.address).toContain("Mission St");
    expect(first.lat).toBeCloseTo(37.7749);
    expect(first.lng).toBeCloseTo(-122.4194);
    expect(first.kind).toBe("saved");
    expect(first.starRating).toBeNull();
  });

  it("parses reviews including the older Title Case format", () => {
    const items = parseTakeout(REVIEWS);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      name: "Noodle Palace",
      kind: "review",
      starRating: 4,
      placeId: "ChIJabc123_-XYZ",
    });
    expect(items[1]).toMatchObject({
      name: "Old Format Diner",
      kind: "review",
      starRating: 5,
      address: "3 Elm St",
    });
  });

  it("throws a friendly error on garbage input", () => {
    expect(() => parseTakeout("not json")).toThrow(/isn't valid JSON/);
    expect(() => parseTakeout('{"foo": 1}')).toThrow(/Couldn't find any places/);
  });
});

describe("parseTakeoutCsv", () => {
  const CSV = `Title,Note,URL,Comment
"Tasty Corner","","https://www.google.com/maps/place/?q=place_id:ChIJxyz789",""
"Commas, Quotes ""& Co""","note","https://maps.google.com/?cid=55",""
"Tasty Corner","dupe","https://www.google.com/maps/place/?q=place_id:ChIJxyz789",""
`;

  it("parses Saved-list CSVs with quoting and dedupes by URL", () => {
    const items = parseTakeoutCsv(CSV);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      name: "Tasty Corner",
      kind: "saved",
      placeId: "ChIJxyz789",
    });
    expect(items[1].name).toBe('Commas, Quotes "& Co"');
  });

  it("throws a friendly error without a Title column", () => {
    expect(() => parseTakeoutCsv("foo,bar\n1,2\n")).toThrow(/Title column/);
  });
});

describe("parseTakeoutAny", () => {
  it("routes by content/filename", () => {
    expect(parseTakeoutAny(SAVED_PLACES, "Saved Places.json")).toHaveLength(2);
    expect(parseTakeoutAny('Title,Note,URL\n"A Place","",""\n', "Favorites.csv")).toHaveLength(1);
    expect(parseTakeoutAny('Title,Note,URL\n"A Place","",""\n')).toHaveLength(1);
  });
});

describe("starToScore", () => {
  it("maps 1-5 stars onto 1-10", () => {
    expect(starToScore(5)).toBe(10);
    expect(starToScore(3.5)).toBe(7);
    expect(starToScore(1)).toBe(2);
  });
});
