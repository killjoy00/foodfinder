import { describe, expect, it } from "vitest";
import { tallyVotes } from "../lib/vote";
import { Vote } from "../lib/types";

function vote(
  profileId: string,
  pickId: string | null,
  vetoId: string | null = null,
  deferred = false
): Vote {
  return { sessionId: "s", profileId, pickId, vetoId, deferred };
}

describe("tallyVotes", () => {
  const candidates = ["a", "b", "c"];

  it("most picks wins", () => {
    const votes = [vote("p1", "a"), vote("p2", "a"), vote("p3", "b")];
    expect(tallyVotes(candidates, votes)).toBe("a");
  });

  it("vetoed candidates lose even with the most picks", () => {
    const votes = [vote("p1", "a"), vote("p2", "a"), vote("p3", "b", "a")];
    expect(tallyVotes(candidates, votes)).toBe("b");
  });

  it("ignores vetoes when everything got vetoed", () => {
    const votes = [vote("p1", "a", "b"), vote("p2", "b", "c"), vote("p3", "c", "a")];
    const winner = tallyVotes(candidates, votes, () => 0);
    expect(candidates).toContain(winner);
  });

  it("breaks ties randomly among the tied", () => {
    const votes = [vote("p1", "a"), vote("p2", "b")];
    expect(tallyVotes(candidates, votes, () => 0)).toBe("a");
    expect(tallyVotes(candidates, votes, () => 0.99)).toBe("b");
  });

  it("does not count deferred votes", () => {
    const votes = [vote("p1", "a", null, true), vote("p2", "b")];
    expect(tallyVotes(candidates, votes)).toBe("b");
  });

  it("counts a banked double vote twice (a 2x pick ties two single picks)", () => {
    // p1 picks 'a' with a double credit (weight 2); p2 + p3 pick 'b' (1 each)
    const votes = [vote("p1", "a"), vote("p2", "b"), vote("p3", "b")];
    const weightOf = (id: string) => (id === "p1" ? 2 : 1);
    // 2 vs 2 -> tie; rng 0 resolves to the first alive candidate ('a')
    expect(tallyVotes(candidates, votes, () => 0, weightOf)).toBe("a");
  });

  it("a double vote overturns a single pick", () => {
    const votes = [vote("p1", "a"), vote("p2", "b")];
    const weightOf = (id: string) => (id === "p1" ? 2 : 1);
    expect(tallyVotes(candidates, votes, () => 0.99, weightOf)).toBe("a");
  });

  it("handles empty input", () => {
    expect(tallyVotes([], [])).toBeNull();
  });
});
