import { createHash, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

/** The original scheme: unsalted SHA-256 with a static prefix. Kept only to
 *  verify pre-migration hashes; never used for new passwords. */
export function legacyPasswordHash(password: string): string {
  return createHash("sha256").update(`foodfinder:${password}`).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Check a password against a stored hash of either scheme. `needsRehash`
 * signals a correct password verified against a legacy hash — the caller
 * should re-store it with `hashPassword` (lazy migration on login).
 */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (stored.startsWith("$2")) {
    return { ok: await bcrypt.compare(password, stored), needsRehash: false };
  }
  const ok = safeEqual(legacyPasswordHash(password), stored);
  return { ok, needsRehash: ok };
}
