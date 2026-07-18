import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_HOUSEHOLD_ID, db, isDemoMode, registry } from "./data";
import { hashPassword, verifyPassword } from "./password";
import {
  clearActiveHousehold,
  getActiveHouseholdId,
  setActiveHousehold,
} from "./household";
import { Household, Profile } from "./types";

const PROFILE_COOKIE = "ff_profile";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// ---------- households (groups) ----------

export async function isAuthed(): Promise<boolean> {
  if (isDemoMode()) return true;
  return (await getActiveHouseholdId()) !== null;
}

export async function getActiveHousehold(): Promise<Household | null> {
  const id = (await getActiveHouseholdId()) ?? (isDemoMode() ? DEMO_HOUSEHOLD_ID : null);
  if (!id) return null;
  return registry().getHousehold(id);
}

export async function loginToHousehold(name: string, password: string): Promise<boolean> {
  if (isDemoMode()) {
    await setActiveHousehold(DEMO_HOUSEHOLD_ID);
    return true;
  }
  const household = await registry().findHouseholdByName(name);
  if (!household) return false;
  const check = await verifyPassword(password, household.passwordHash);
  if (!check.ok) return false;
  if (check.needsRehash) {
    // lazy migration off the legacy SHA-256 scheme
    await registry().setHouseholdPassword(household.id, await hashPassword(password));
  }
  await setActiveHousehold(household.id);
  await clearActiveProfile(); // don't carry a profile over from another group
  return true;
}

export async function createHousehold(
  name: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = name.trim();
  if (trimmed.length < 2) return { ok: false, error: "Pick a group name (2+ characters)." };
  if (password.length < 4) return { ok: false, error: "Pick a password (4+ characters)." };
  if (isDemoMode()) {
    await setActiveHousehold(DEMO_HOUSEHOLD_ID);
    return { ok: true };
  }
  const existing = await registry().findHouseholdByName(trimmed);
  if (existing) return { ok: false, error: "That group name is already taken." };
  const household = await registry().createHousehold(trimmed, await hashPassword(password));
  await setActiveHousehold(household.id);
  await clearActiveProfile();
  return { ok: true };
}

/**
 * Change the logged-in group's password. Being logged in (a valid signed
 * household cookie) is itself proof of access — so this also doubles as
 * recovery: any still-logged-in device can reset a forgotten password.
 */
export async function changeGroupPassword(
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  if (newPassword.length < 4) return { ok: false, error: "Pick a password (4+ characters)." };
  if (isDemoMode()) return { ok: false, error: "Passwords aren't used in demo mode." };
  const id = await getActiveHouseholdId();
  if (!id) return { ok: false, error: "You're not logged into a group." };
  await registry().setHouseholdPassword(id, await hashPassword(newPassword));
  return { ok: true };
}

export async function logout(): Promise<void> {
  await clearActiveProfile();
  await clearActiveHousehold();
}

// ---------- profiles (within a group) ----------

export async function setActiveProfile(profileId: string): Promise<void> {
  const jar = await cookies();
  jar.set(PROFILE_COOKIE, profileId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function clearActiveProfile(): Promise<void> {
  const jar = await cookies();
  jar.delete(PROFILE_COOKIE);
}

export async function getActiveProfile(): Promise<Profile | null> {
  const jar = await cookies();
  const id = jar.get(PROFILE_COOKIE)?.value;
  if (!id) return null;
  // scoped to the active household, so a foreign profile id won't resolve
  const profiles = await (await db()).listProfiles();
  return profiles.find((p) => p.id === id) ?? null;
}

/**
 * Guard for app pages: require a logged-in group, then a chosen profile.
 * Returns the active profile.
 */
export async function requireProfile(): Promise<Profile> {
  if (!(await isAuthed())) redirect("/login");
  const profile = await getActiveProfile();
  if (!profile) redirect("/profiles");
  return profile;
}
