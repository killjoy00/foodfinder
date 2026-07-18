/**
 * The secret that signs auth cookies. In a real production deployment
 * (Supabase configured) it must be set explicitly — a guessable fallback
 * would let anyone forge a login cookie for any group. The dev fallback
 * survives only for local dev and demo mode.
 */
export function authSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.CRON_SECRET;
  if (secret) return secret;
  const demo = !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.NODE_ENV === "production" && !demo) {
    throw new Error(
      "AUTH_SECRET is not set. Add it (any long random string) to the deployment's environment variables — refusing to sign auth cookies with the built-in dev secret."
    );
  }
  return "foodfinder-dev-secret";
}
