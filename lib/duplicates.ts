import { RestaurantFull } from "./types";
import { distanceMiles } from "./distance";

export type DuplicatePair = {
  a: RestaurantFull;
  b: RestaurantFull;
  reason: string;
  confidence: "high" | "medium";
};

const NOISE_WORDS = new Set(["the", "restaurant", "cafe", "grill", "kitchen", "bar", "co", "and"]);

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accent marks
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !NOISE_WORDS.has(w))
    .join(" ")
    .trim();
}

/** Levenshtein ratio in [0,1]; 1 means identical. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(
        dp[i] + 1,
        dp[i - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prev = tmp;
    }
  }
  const distance = dp[m];
  return 1 - distance / Math.max(m, n);
}

/**
 * Find likely-duplicate restaurant pairs: same Google place id, identical
 * normalized names, or very similar names that are geographically close
 * (or have no coordinates to contradict the match).
 */
export function findDuplicatePairs(restaurants: RestaurantFull[]): DuplicatePair[] {
  const pairs: DuplicatePair[] = [];
  const normalized = restaurants.map((r) => normalizeName(r.name));

  for (let i = 0; i < restaurants.length; i++) {
    for (let j = i + 1; j < restaurants.length; j++) {
      const a = restaurants[i];
      const b = restaurants[j];

      if (a.googlePlaceId && b.googlePlaceId && a.googlePlaceId === b.googlePlaceId) {
        pairs.push({ a, b, reason: "Same Google place", confidence: "high" });
        continue;
      }

      const na = normalized[i];
      const nb = normalized[j];
      if (!na || !nb) continue;

      const sim = similarity(na, nb);
      if (na === nb) {
        pairs.push({ a, b, reason: "Same name", confidence: "high" });
        continue;
      }
      if (sim >= 0.84) {
        const dist = distanceMiles(a, b);
        // a near-match is only a likely dupe if they're plausibly the same
        // spot: close together, or we simply lack coordinates to tell.
        if (dist === null || dist <= 1) {
          pairs.push({
            a,
            b,
            reason: dist === null ? "Very similar name" : `Very similar name, ${dist.toFixed(1)} mi apart`,
            confidence: "medium",
          });
        }
      }
    }
  }

  return pairs.sort((x, y) => (x.confidence === y.confidence ? 0 : x.confidence === "high" ? -1 : 1));
}
