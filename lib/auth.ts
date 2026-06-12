import { createHash } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./data";
import { Profile } from "./types";

const AUTH_COOKIE = "ff_auth";
const PROFILE_COOKIE = "ff_profile";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // a year — it's a family app

function passwordHash(password: string): string {
  return createHash("sha256").update(`foodfinder:${password}`).digest("hex");
}

/** No FAMILY_PASSWORD env var → no password gate (demo / trusted setup). */
export function passwordRequired(): boolean {
  return !!process.env.FAMILY_PASSWORD;
}

export async function isAuthed(): Promise<boolean> {
  if (!passwordRequired()) return true;
  const jar = await cookies();
  return jar.get(AUTH_COOKIE)?.value === passwordHash(process.env.FAMILY_PASSWORD!);
}

export async function login(password: string): Promise<boolean> {
  if (password !== process.env.FAMILY_PASSWORD) return false;
  const jar = await cookies();
  jar.set(AUTH_COOKIE, passwordHash(password), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return true;
}

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
  const profiles = await db().listProfiles();
  return profiles.find((p) => p.id === id) ?? null;
}

/**
 * Guard for app pages: bounce to the password gate, then the profile
 * picker, before letting anyone in. Returns the active profile.
 */
export async function requireProfile(): Promise<Profile> {
  if (!(await isAuthed())) redirect("/login");
  const profile = await getActiveProfile();
  if (!profile) redirect("/profiles");
  return profile;
}
