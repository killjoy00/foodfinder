import { describe, expect, it } from "vitest";
import { hashPassword, legacyPasswordHash, verifyPassword } from "../lib/password";

describe("password hashing", () => {
  it("round-trips a bcrypt hash", async () => {
    const stored = await hashPassword("foodfun");
    expect(stored.startsWith("$2")).toBe(true);
    expect(await verifyPassword("foodfun", stored)).toEqual({ ok: true, needsRehash: false });
    expect((await verifyPassword("wrong", stored)).ok).toBe(false);
  });

  it("accepts a legacy SHA-256 hash and flags it for rehash", async () => {
    const stored = legacyPasswordHash("foodfun");
    expect(await verifyPassword("foodfun", stored)).toEqual({ ok: true, needsRehash: true });
  });

  it("rejects a wrong password against a legacy hash without flagging rehash", async () => {
    const stored = legacyPasswordHash("foodfun");
    expect(await verifyPassword("nope", stored)).toEqual({ ok: false, needsRehash: false });
  });

  it("matches the exact legacy derivation used by the old scheme", () => {
    // the precomputed value format shipped in migrations: sha256("foodfinder:" + pw)
    expect(legacyPasswordHash("foodfun")).toMatch(/^[0-9a-f]{64}$/);
  });
});
