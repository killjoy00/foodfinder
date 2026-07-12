import { cookies, headers } from "next/headers";
import { signHouseholdToken, verifyHouseholdToken } from "./token";

const HOUSEHOLD_COOKIE = "ff_household";
const MAX_AGE = 60 * 60 * 24 * 365; // a year

/**
 * The logged-in group for this request. Web clients carry the signed token
 * in a cookie; the mobile app sends the same token as a bearer header.
 */
export async function getActiveHouseholdId(): Promise<string | null> {
  const jar = await cookies();
  const cookieToken = jar.get(HOUSEHOLD_COOKIE)?.value;
  if (cookieToken) {
    const id = verifyHouseholdToken(cookieToken);
    if (id) return id;
  }
  const auth = (await headers()).get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return verifyHouseholdToken(auth.slice("Bearer ".length).trim());
  }
  return null;
}

export async function setActiveHousehold(id: string): Promise<void> {
  const jar = await cookies();
  jar.set(HOUSEHOLD_COOKIE, signHouseholdToken(id), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function clearActiveHousehold(): Promise<void> {
  const jar = await cookies();
  jar.delete(HOUSEHOLD_COOKIE);
}
