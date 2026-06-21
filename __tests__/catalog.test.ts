import { describe, expect, it } from "vitest";
import { parseCatalogCsv, priceTier } from "../lib/catalog";

describe("priceTier", () => {
  it("maps dollar signs and ranges to 1-4", () => {
    expect(priceTier("$")).toBe(1);
    expect(priceTier("$$$")).toBe(3);
    expect(priceTier("$10-20")).toBe(2);
    expect(priceTier("$30-80")).toBe(4);
    expect(priceTier("")).toBe(2);
  });
});

describe("parseCatalogCsv", () => {
  const AUSTIN = `Name,Neighborhood,Cuisine,Price,Our tier,Website,Google Maps
24 Diner,Old West Austin,American,$20-30,Top tier,http://x.com,https://www.google.com/maps/search/?api=1&query=24%20Diner&query_place_id=ChIJabc123
"Amaya's Taco Village",North Loop,Mexican & Tex-Mex,$,Top tier,,https://www.google.com/maps/search/?api=1&query=Amaya&query_place_id=ChIJxyz789
`;

  it("parses the Austin format, pulling place ids and tiers", () => {
    const rows = parseCatalogCsv(AUSTIN, "Austin, TX");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: "24 Diner",
      cuisines: ["American"],
      price: 2,
      address: "Old West Austin, Austin, TX",
      googlePlaceId: "ChIJabc123",
    });
    // "Mexican & Tex-Mex" stays one cuisine; quotes/apostrophes handled
    expect(rows[1].name).toBe("Amaya's Taco Village");
    expect(rows[1].cuisines).toEqual(["Mexican & Tex-Mex"]);
    expect(rows[1].price).toBe(1);
  });

  it("dedupes by place id within the file", () => {
    const dupe = `Name,Cuisine,Google Maps
A,Pizza,https://x/?query_place_id=ChIJsame
A2,Pizza,https://x/?query_place_id=ChIJsame
`;
    expect(parseCatalogCsv(dupe)).toHaveLength(1);
  });

  it("throws without a Name column", () => {
    expect(() => parseCatalogCsv("Foo,Bar\n1,2\n")).toThrow(/Name column/);
  });
});
