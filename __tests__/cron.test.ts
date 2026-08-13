import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { cronGuard } from "../lib/cron";

// The regression this file exists for: the previous guard was `if (secret && …)`, so an unset
// CRON_SECRET skipped the check entirely and left /api/cron/sweep open to the internet — a billed
// Places call per group per request, group names in the response, and a database write each time.
// The "unset secret in production" cases below are the ones that must never go back to allowing.

const req = (auth?: string) =>
  new NextRequest("https://foodfinder.example/api/cron/sweep", {
    headers: auth ? { authorization: auth } : {}
  });

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

// NODE_ENV is readonly in the Next types but writable at runtime; tests need to drive it.
const setEnv = (vals: Record<string, string | undefined>) => {
  for (const [k, v] of Object.entries(vals)) {
    if (v === undefined) delete (process.env as Record<string, string | undefined>)[k];
    else (process.env as Record<string, string | undefined>)[k] = v;
  }
};

const prod = () =>
  setEnv({
    NODE_ENV: "production",
    SUPABASE_URL: "https://x.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key"
  });

describe("cronGuard", () => {
  it("allows a request carrying the right bearer token", () => {
    prod();
    setEnv({ CRON_SECRET: "s3cret" });
    expect(cronGuard(req("Bearer s3cret"))).toBeNull();
  });

  it("rejects a wrong bearer token", () => {
    prod();
    setEnv({ CRON_SECRET: "s3cret" });
    expect(cronGuard(req("Bearer wrong"))?.status).toBe(401);
  });

  it("rejects a missing header when the secret is set", () => {
    prod();
    setEnv({ CRON_SECRET: "s3cret" });
    expect(cronGuard(req())?.status).toBe(401);
  });

  it("FAILS CLOSED when the secret is unset in production", () => {
    prod();
    setEnv({ CRON_SECRET: undefined });
    const res = cronGuard(req());
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });

  it("fails closed for an unset secret even if a caller sends some token", () => {
    prod();
    setEnv({ CRON_SECRET: undefined });
    expect(cronGuard(req("Bearer anything"))?.status).toBe(401);
  });

  it("fails closed for an empty-string secret, not just an absent one", () => {
    prod();
    setEnv({ CRON_SECRET: "" });
    expect(cronGuard(req())?.status).toBe(401);
  });

  it("stays open in demo mode, where there is no real data to protect", () => {
    setEnv({
      NODE_ENV: "production",
      CRON_SECRET: undefined,
      SUPABASE_URL: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined
    });
    expect(cronGuard(req())).toBeNull();
  });

  it("stays open in local dev so `npm run dev` needs no secret", () => {
    setEnv({
      NODE_ENV: "development",
      CRON_SECRET: undefined,
      SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key"
    });
    expect(cronGuard(req())).toBeNull();
  });

  it("still enforces a configured secret in dev", () => {
    setEnv({ NODE_ENV: "development", CRON_SECRET: "s3cret" });
    expect(cronGuard(req("Bearer nope"))?.status).toBe(401);
    expect(cronGuard(req("Bearer s3cret"))).toBeNull();
  });
});
