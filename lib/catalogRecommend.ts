import { CatalogEntry } from "./data/adapter";
import { RestaurantFull } from "./types";

const STOP = new Set(["and", "the", "other", "food", "amp", "with"]);

/** Cuisine → comparable tokens, so "Mexican" matches "Mexican & Tex-Mex". */
function cuisineTokens(cuisine: string): string[] {
  return cuisine
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

export type TokenAffinity = Map<string, number>; // token → average family rating (1-10)

/** How much the family likes each cuisine token, from their own ratings. */
export function buildTokenAffinity(restaurants: RestaurantFull[]): TokenAffinity {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const r of restaurants) {
    const scores = Object.values(r.ratings);
    if (scores.length === 0) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const seen = new Set<string>();
    for (const c of r.cuisines) {
      for (const t of cuisineTokens(c)) {
        if (seen.has(t)) continue;
        seen.add(t);
        const e = acc.get(t) ?? { sum: 0, n: 0 };
        e.sum += avg;
        e.n += 1;
        acc.set(t, e);
      }
    }
  }
  const out: TokenAffinity = new Map();
  for (const [t, { sum, n }] of acc) out.set(t, sum / n);
  return out;
}

export type CatalogPick = { entry: CatalogEntry; affinity: number; via: string };

/**
 * Rank untracked catalog restaurants by how well their cuisine matches what
 * the family already rates highly. Pure and local — no external API.
 */
export function recommendFromCatalog(
  catalog: CatalogEntry[],
  affinity: TokenAffinity,
  opts: { limit?: number; minScore?: number } = {}
): CatalogPick[] {
  const limit = opts.limit ?? 12;
  const minScore = opts.minScore ?? 6.5;
  if (affinity.size === 0) return [];
  const picks: CatalogPick[] = [];
  for (const e of catalog) {
    if (e.tracked) continue;
    let best = 0;
    let via = "";
    for (const c of e.cuisines) {
      for (const t of cuisineTokens(c)) {
        const a = affinity.get(t);
        if (a !== undefined && a > best) {
          best = a;
          via = c;
        }
      }
    }
    if (best >= minScore) picks.push({ entry: e, affinity: best, via });
  }
  picks.sort((a, b) => b.affinity - a.affinity || a.entry.name.localeCompare(b.entry.name));
  return picks.slice(0, limit);
}

/** "Riverside, Austin, TX" → "Riverside". */
export function neighborhoodOf(address: string | null): string | null {
  if (!address) return null;
  const first = address.split(",")[0]?.trim();
  return first || null;
}

export function catalogNeighborhoods(catalog: CatalogEntry[]): string[] {
  const set = new Set<string>();
  for (const e of catalog) {
    const hood = neighborhoodOf(e.address);
    if (hood) set.add(hood);
  }
  return [...set].sort();
}
