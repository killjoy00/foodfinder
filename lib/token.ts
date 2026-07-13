import { createHmac } from "crypto";

/**
 * HMAC-signed household tokens. The same token backs both the web login
 * cookie (lib/household.ts) and the mobile app's bearer token, so one
 * secret and one format cover every client.
 */

function secret(): string {
  return process.env.AUTH_SECRET || process.env.CRON_SECRET || "foodfinder-dev-secret";
}

/** Sign the household id so a client can't swap its token to another group. */
export function signHouseholdToken(id: string): string {
  const sig = createHmac("sha256", secret()).update(id).digest("hex").slice(0, 32);
  return `${id}.${sig}`;
}

/** Verify a token; returns the household id or null when tampered/malformed. */
export function verifyHouseholdToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expect = createHmac("sha256", secret()).update(id).digest("hex").slice(0, 32);
  return sig === expect ? id : null;
}
