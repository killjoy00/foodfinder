import { createHmac } from "crypto";
import { cookies } from "next/headers";

const HOUSEHOLD_COOKIE = "ff_household";
const MAX_AGE = 60 * 60 * 24 * 365; // a year

function secret(): string {
  return process.env.AUTH_SECRET || process.env.CRON_SECRET || "foodfinder-dev-secret";
}

/** Sign the household id so a user can't swap their cookie to another group. */
function sign(id: string): string {
  const sig = createHmac("sha256", secret()).update(id).digest("hex").slice(0, 32);
  return `${id}.${sig}`;
}

function verify(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expect = createHmac("sha256", secret()).update(id).digest("hex").slice(0, 32);
  return sig === expect ? id : null;
}

export async function getActiveHouseholdId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(HOUSEHOLD_COOKIE)?.value;
  return token ? verify(token) : null;
}

export async function setActiveHousehold(id: string): Promise<void> {
  const jar = await cookies();
  jar.set(HOUSEHOLD_COOKIE, sign(id), { httpOnly: true, sameSite: "lax", maxAge: MAX_AGE, path: "/" });
}

export async function clearActiveHousehold(): Promise<void> {
  const jar = await cookies();
  jar.delete(HOUSEHOLD_COOKIE);
}
