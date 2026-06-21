"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { trackRestaurantAction } from "@/app/actions";
import { CatalogEntry } from "@/lib/data/adapter";
import { PRICE_LABELS } from "@/lib/types";
import { LatLng, distanceMiles, formatMiles } from "@/lib/distance";
import { Chip } from "./ui";

const DISTANCE_CHOICES = [0, 3, 5, 10, 25]; // 0 = any

export function BrowseClient({ catalog, home }: { catalog: CatalogEntry[]; home: LatLng }) {
  const [query, setQuery] = useState("");
  const [maxDistance, setMaxDistance] = useState(0);
  const [hideTracked, setHideTracked] = useState(true);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<Record<string, "active" | "wishlist">>({});
  const hasHome = home.lat !== null && home.lng !== null;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog
      .map((c) => ({ c, dist: hasHome ? distanceMiles(home, c) : null }))
      .filter(({ c }) => !hideTracked || (!c.tracked && !done[c.id]))
      .filter(
        ({ c }) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.cuisines.some((x) => x.toLowerCase().includes(q))
      )
      .filter(({ dist }) => maxDistance === 0 || (dist !== null && dist <= maxDistance))
      .sort((a, b) => {
        if (a.dist !== null && b.dist !== null) return a.dist - b.dist;
        return a.c.name.localeCompare(b.c.name);
      })
      .slice(0, 300);
  }, [catalog, query, maxDistance, hideTracked, hasHome, home, done]);

  function track(id: string, status: "active" | "wishlist") {
    startTransition(async () => {
      await trackRestaurantAction(id, status);
      setDone((prev) => ({ ...prev, [id]: status }));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the catalog…"
        className="rounded-xl border border-border-soft bg-surface px-4 py-2.5 outline-none focus:border-accent"
      />
      <div className="flex flex-wrap items-center gap-2">
        {hasHome &&
          DISTANCE_CHOICES.map((mi) => (
            <Chip key={mi} active={maxDistance === mi} onClick={() => setMaxDistance(mi)}>
              {mi === 0 ? "Any distance" : `${mi} mi`}
            </Chip>
          ))}
        <Chip active={hideTracked} onClick={() => setHideTracked((v) => !v)}>
          {hideTracked ? "Hiding ones I track" : "Showing all"}
        </Chip>
      </div>

      <p className="text-xs text-muted">{shown.length} shown</p>

      <ul className="flex flex-col gap-2">
        {shown.map(({ c, dist }) => {
          const added = done[c.id];
          return (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{c.name}</p>
                <p className="truncate text-sm text-muted">
                  {c.cuisines.join(" · ") || "uncategorized"} · {PRICE_LABELS[c.price - 1]}
                  {dist !== null && ` · ${formatMiles(dist)}`}
                </p>
              </div>
              {added ? (
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded-lg bg-green-950/60 px-3 py-2 text-sm font-semibold text-green-300">
                    {added === "wishlist" ? "⭐ Added to wishlist" : "🍽️ Marked been there"}
                  </span>
                  <Link href={`/restaurants/${c.id}`} className="text-xs text-accent underline">
                    Edit cuisine / tags →
                  </Link>
                </div>
              ) : c.tracked ? (
                <span className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold text-muted">
                  {c.trackedStatus === "wishlist" ? "⭐ Wishlist" : "🍽️ On your list"}
                </span>
              ) : (
                <div className="flex gap-1">
                  <button
                    disabled={pending}
                    onClick={() => track(c.id, "wishlist")}
                    className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold"
                  >
                    ⭐ Want
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => track(c.id, "active")}
                    className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-black"
                  >
                    ✓ Been
                  </button>
                </div>
              )}
            </li>
          );
        })}
        {shown.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border-soft p-8 text-center text-muted">
            Nothing matches. The catalog grows as families add restaurants.
          </li>
        )}
      </ul>
    </div>
  );
}
