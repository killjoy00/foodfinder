import { describe, expect, it } from "vitest";
import { cuisinesFromTypes } from "../lib/places";

describe("cuisinesFromTypes", () => {
  it("maps known restaurant types to friendly cuisine labels", () => {
    expect(
      cuisinesFromTypes(["mexican_restaurant", "restaurant", "food", "point_of_interest"])
    ).toEqual(["Mexican"]);
  });

  it("maps multiple cuisines and dedupes", () => {
    expect(cuisinesFromTypes(["sushi_restaurant", "japanese_restaurant"])).toEqual([
      "Sushi",
      "Japanese",
    ]);
  });

  it("title-cases unknown _restaurant types as a fallback", () => {
    expect(cuisinesFromTypes(["ethiopian_restaurant"])).toEqual(["Ethiopian"]);
  });

  it("ignores generic non-cuisine types", () => {
    expect(
      cuisinesFromTypes(["restaurant", "fast_food_restaurant", "cafe", "bar", "food"])
    ).toEqual([]);
  });

  it("returns an empty list when there are no types", () => {
    expect(cuisinesFromTypes([])).toEqual([]);
  });
});
