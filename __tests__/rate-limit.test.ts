import { describe, expect, it } from "vitest";
import { rateLimit } from "../lib/rateLimit";

describe("rateLimit", () => {
  it("allows up to the limit inside one window, then blocks", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit("a:1.1.1.1", 3, 60_000, t0 + i)).toBe(true);
    expect(rateLimit("a:1.1.1.1", 3, 60_000, t0 + 10)).toBe(false);
  });

  it("resets after the window passes", () => {
    const t0 = 2_000_000;
    for (let i = 0; i < 4; i++) rateLimit("b:1.1.1.1", 3, 60_000, t0);
    expect(rateLimit("b:1.1.1.1", 3, 60_000, t0 + 60_001)).toBe(true);
  });

  it("tracks keys independently", () => {
    const t0 = 3_000_000;
    for (let i = 0; i < 4; i++) rateLimit("c:1.1.1.1", 3, 60_000, t0);
    expect(rateLimit("c:1.1.1.1", 3, 60_000, t0)).toBe(false);
    expect(rateLimit("c:2.2.2.2", 3, 60_000, t0)).toBe(true);
  });
});
