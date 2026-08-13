import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "./data";

/**
 * Authorisation for the Vercel Cron endpoints.
 *
 * These routes sit outside the login wall by design — `middleware.ts` excludes `/api` on the
 * stated assumption that the cron routes check `CRON_SECRET` themselves. That assumption only
 * held while the secret was set. The previous check was `if (secret && header !== …)`, which
 * skipped itself entirely when `CRON_SECRET` was empty, leaving `/api/cron/sweep` open to the
 * internet: a billed Google Places call per group per request, the group names in the response,
 * and a database write every time.
 *
 * So it fails closed instead. The exemption mirrors `lib/secret.ts`: demo mode and local dev have
 * no real data to protect and no secret to configure, and breaking `npm run dev` to guard a demo
 * database is a bad trade. A real deployment — production, Supabase configured — must have the
 * secret or these endpoints refuse to run.
 *
 * Returns a 401 response to return immediately, or null when the request may proceed.
 */
export function cronGuard(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    return req.headers.get("authorization") === `Bearer ${secret}`
      ? null
      : NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // No secret configured. Open only where there is nothing to protect.
  if (isDemoMode() || process.env.NODE_ENV !== "production") return null;

  return NextResponse.json(
    { error: "cron_secret_not_configured" },
    { status: 401 }
  );
}
