import { describe, expect, it } from "vitest";
import { signHouseholdToken, verifyHouseholdToken } from "../lib/token";

describe("household tokens", () => {
  it("round-trips a household id", () => {
    const token = signHouseholdToken("hh-123");
    expect(verifyHouseholdToken(token)).toBe("hh-123");
  });

  it("keeps ids containing dots intact", () => {
    const token = signHouseholdToken("a.b.c");
    expect(verifyHouseholdToken(token)).toBe("a.b.c");
  });

  it("rejects a tampered id", () => {
    const token = signHouseholdToken("hh-123");
    const sig = token.slice(token.lastIndexOf(".") + 1);
    expect(verifyHouseholdToken(`hh-456.${sig}`)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = signHouseholdToken("hh-123");
    expect(verifyHouseholdToken(token.slice(0, -1) + (token.endsWith("0") ? "1" : "0"))).toBeNull();
  });

  it("rejects garbage", () => {
    expect(verifyHouseholdToken("")).toBeNull();
    expect(verifyHouseholdToken("no-dot")).toBeNull();
    expect(verifyHouseholdToken("id.badsig")).toBeNull();
  });
});
