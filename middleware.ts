import { NextRequest, NextResponse } from "next/server";

/**
 * Edge auth guard for app pages: a request without a validly signed
 * ff_household cookie is bounced to /login before any page code runs.
 * Pages and actions keep their own requireProfile() checks — this is the
 * outer wall, not the only one. Runs on the edge runtime, so the HMAC
 * check uses Web Crypto (mirrors lib/household.ts sign()).
 */

const HOUSEHOLD_COOKIE = "ff_household";

function isDemoMode(): boolean {
  return !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyCookie(token: string, secret: string): Promise<boolean> {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return false;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(id)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
  return timingSafeEqualHex(hex, sig);
}

export async function middleware(request: NextRequest) {
  if (isDemoMode()) return NextResponse.next();
  const secret = process.env.AUTH_SECRET || process.env.CRON_SECRET;
  const token = request.cookies.get(HOUSEHOLD_COOKIE)?.value;
  if (secret && token && (await verifyCookie(token, secret))) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // guard app pages; /login, /admin (own guard), /api (own checks: cookies on
  // export/places, CRON_SECRET on crons), and static assets stay open
  matcher: [
    "/((?!login|admin|api|_next|icons|favicon\\.ico|manifest\\.webmanifest|sw\\.js|apple-touch-icon).*)",
  ],
};
