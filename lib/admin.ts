import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isDemoMode } from "./data";

const ADMIN_COOKIE = "ff_admin";
const MAX_AGE = 60 * 60 * 24 * 30; // a month — shorter than family logins on purpose

function secret(): string {
  return process.env.AUTH_SECRET || process.env.CRON_SECRET || "foodfinder-dev-secret";
}

/** The cookie holds an HMAC over a fixed label, so only the server can mint it. */
function adminToken(): string {
  return createHmac("sha256", secret()).update("ff-admin-v1").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Admin exists only when the operator has set ADMIN_SECRET (always on in demo mode). */
export function isAdminConfigured(): boolean {
  return isDemoMode() || !!process.env.ADMIN_SECRET;
}

export async function isAdminAuthed(): Promise<boolean> {
  if (!isAdminConfigured()) return false;
  if (isDemoMode()) return true;
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  return !!token && safeEqual(token, adminToken());
}

export async function loginAdmin(attempt: string): Promise<boolean> {
  if (!isAdminConfigured()) return false;
  if (!isDemoMode()) {
    const expected = process.env.ADMIN_SECRET!;
    if (!attempt || !safeEqual(attempt, expected)) return false;
  }
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, adminToken(), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/admin",
  });
  return true;
}

export async function logoutAdmin(): Promise<void> {
  const jar = await cookies();
  jar.delete({ name: ADMIN_COOKIE, path: "/admin" });
}

/** Guard for admin pages and actions. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdminAuthed())) redirect("/admin/login");
}
