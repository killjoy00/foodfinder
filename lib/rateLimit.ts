import { headers } from "next/headers";

type Bucket = { count: number; resetAt: number };

const g = globalThis as unknown as { __ffRateBuckets?: Map<string, Bucket> };

function buckets(): Map<string, Bucket> {
  if (!g.__ffRateBuckets) g.__ffRateBuckets = new Map();
  return g.__ffRateBuckets;
}

/**
 * Fixed-window limiter. Returns true when the call is allowed. In-memory, so
 * on serverless it's per-instance — a determined attacker spread across
 * instances gets more than `limit`, but the common cases (credential
 * stuffing from one box, runaway scripts) are stopped. Good enough until
 * there's a shared store.
 */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const map = buckets();
  // opportunistic cleanup so the map can't grow unbounded
  if (map.size > 10_000) {
    for (const [k, b] of map) if (b.resetAt <= now) map.delete(k);
  }
  const bucket = map.get(key);
  if (!bucket || bucket.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count++;
  return bucket.count <= limit;
}

/** The caller's IP as reported by the platform (Vercel sets x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

/** Per-IP limiter for a named action; true when allowed. */
export async function allowRequest(action: string, limit: number, windowMs: number): Promise<boolean> {
  const ip = await clientIp();
  return rateLimit(`${action}:${ip}`, limit, windowMs);
}

export const RATE_LIMITED_MESSAGE = "Too many attempts — wait a few minutes and try again.";
