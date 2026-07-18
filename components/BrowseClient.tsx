"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { trackRestaurantAction, trackRestaurantsBulkAction } from "@/app/actions";
import { CatalogEntry } from "@/lib/data/adapter";
import { PRICE_LABELS } from "@/lib/types";
import { LatLng, distanceMiles, formatMiles } from "@/lib/distance";
import { catalogNeighborhoods, neighborhoodOf } from "@/lib/catalogRecommend";
import { Chip } from "./ui";

const DISTANCE_CHOICES = [0, 3, 5, 10, 25]; // 0 = any
const PAGE = 60; // how many to reveal at a time (keeps the DOM light)

export function BrowseClient({
  catalog,
  home,
  pickIds = [],
}: {
  catalog: CatalogEntry[];
  home: LatLng;
  pickIds?: string[];
}) {
  const [query, setQuery] = useState("");
  const [maxDistance, setMaxDistance] = useState(0);
  const [neighborhood, setNeighborhood] = useState("");
  const [hideTracked, setHideTracked] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<Record<string, "active" | "wishlist">>({});
  const hasHome = home.lat !== null && home.lng !== null;

  const neighborhoods = useMemo(() => catalogNeighborhoods(catalog), [catalog]);
  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);

  function matchesFilters(c: CatalogEntry, q: string): boolean {
    if (q && !(c.name.toLowerCase().includes(q) || c.cuisines.some((x) => x.toLowerCase().includes(q))))
      return false;
    if (neighborhood && neighborhoodOf(c.address) !== neighborhood) return false;
    if (maxDistance !== 0) {
      const d = hasHome ? distanceMiles(home, c) : null;
      if (d === null || d > maxDistance) return false;
    }
    return true;
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog
      .map((c) => ({ c, dist: hasHome ? distanceMiles(home, c) : null }))
      .filter(({ c }) => !hideTracked || (!c.tracked && !done[c.id]))
      .filter(({ c }) => matchesFilters(c, q))
      .sort((a, b) => {
        if (a.dist !== null && b.dist !== null) return a.dist - b.dist;
        return a.c.name.localeCompare(b.c.name);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, query, maxDistance, neighborhood, hideTracked, hasHome, home, done]);

  // changing the filters should bring the list back to the top page
  useEffect(() => {
    setLimit(PAGE);
  }, [query, maxDistance, neighborhood, hideTracked]);

  const picks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pickIds
      .map((id) => byId.get(id))
      .filter((c): c is CatalogEntry => !!c && !c.tracked && !done[c.id] && matchesFilters(c, q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickIds, byId, query, neighborhood, maxDistance, hasHome, home, done]);

  function track(id: string, status: "active" | "wishlist") {
    startTransition(async () => {
      await trackRestaurantAction(id, status);
      setDone((prev) => ({ ...prev, [id]: status }));
    });
  }

  // every un-tracked result of the current search/filters, for the bulk add
  const bulkIds = useMemo(
    () => shown.filter(({ c }) => !c.tracked && !done[c.id]).map(({ c }) => c.id),
    [shown, done]
  );

  function addAllShown() {
    const ids = bulkIds;
    startTransition(async () => {
      await trackRestaurantsBulkAction(ids, "wishlist");
      setDone((prev) => {
        const next = { ...prev };
        for (const id of ids) next[id] = "wishlist";
        return next;
      });
    });
  }

  function Row({ c, dist }: { c: CatalogEntry; dist: number | null }) {
    const added = done[c.id];
    return (
      <li className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{c.name}</p>
          <p className="truncate text-sm text-muted">
            {c.cuisines.join(" · ") || "uncategorized"} · {PRICE_LABELS[c.price - 1]}
            {neighborhoodOf(c.address) ? ` · ${neighborhoodOf(c.address)}` : ""}
            {dist !== null && ` · ${formatMiles(dist)}`}
          </p>
        </div>
        {added ? (
          <div className="flex flex-col items-end gap-1">
            <span className="rounded-lg bg-green-950/60 px-3 py-2 text-sm font-semibold text-green-300">
              {added === "wishlist" ? "⭐ Added" : "🍽️ Added"}
            </span>
            <Link href={`/restaurants/${c.id}`} className="text-xs text-accent underline">
              Edit cuisine →
            </Link>
          </div>
        ) : (
          <div className="flex gap-1">
            <button
              disabled={pending}
              onClick={() => track(c.id, "wishlist")}
              className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold"
              aria-label={`Add ${c.name} to wishlist`}
            >
              ⭐ Want
            </button>
            <button
              disabled={pending}
              onClick={() => track(c.id, "active")}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-black"
              aria-label={`Mark ${c.name} as been there`}
            >
              ✓ Been
            </button>
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {picks.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-accent bg-accent-soft/20 p-3">
          <h2 className="text-sm font-bold">✨ Top picks for your family</h2>
          <p className="text-xs text-muted">
            Untried spots that match the cuisines you rate highly.
          </p>
          <ul className="flex flex-col gap-2">
            {picks.slice(0, 8).map((c) => (
              <Row key={c.id} c={c} dist={hasHome ? distanceMiles(home, c) : null} />
            ))}
          </ul>
        </section>
      )}

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
      {neighborhoods.length > 0 && (
        <select
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
          className="rounded-xl border border-border-soft bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-accent"
        >
          <option value="">All neighborhoods</option>
          {neighborhoods.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {shown.length === 0
            ? "0 shown"
            : `Showing ${Math.min(limit, shown.length)} of ${shown.length}`}
        </p>
        {bulkIds.length > 1 && (
          <button
            disabled={pending}
            onClick={addAllShown}
            className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {pending ? "Adding…" : `⭐ Add all ${bulkIds.length} shown to wishlist`}
          </button>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {shown.slice(0, limit).map(({ c, dist }) => (
          <Row key={c.id} c={c} dist={dist} />
        ))}
        {shown.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border-soft p-8 text-center text-muted">
            Nothing matches. The catalog grows as families add restaurants.
          </li>
        )}
      </ul>

      {limit < shown.length && (
        <button
          onClick={() => setLimit((n) => n + PAGE)}
          className="self-center rounded-xl border border-border-soft bg-surface-2 px-4 py-2.5 text-sm font-semibold"
        >
          Show more ({shown.length - limit} more)
        </button>
      )}
    </div>
  );
}
