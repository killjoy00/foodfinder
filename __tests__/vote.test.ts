import { describe, expect, it } from "vitest";
import { tallyVotes } from "../lib/vote";
import { Vote } from "../lib/types";

function vote(profileId: string, pickId: string | null, vetoId: string | null = null): Vote {
  return { sessionId: "s", profileId, pickId, vetoId };
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

  it("handles empty input", () => {
    expect(tallyVotes([], [])).toBeNull();
  });
});
