"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState, useTransition } from "react";
import { logVisitAction, setStatusAction } from "@/app/actions";
import { PRICE_LABELS, RestaurantFull, daysSince } from "@/lib/types";
import { LatLng, distanceMiles, formatMiles } from "@/lib/distance";
import { Chip } from "./ui";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60vh] items-center justify-center rounded-2xl border border-border-soft text-muted">
      Loading map…
    </div>
  ),
});

type SortKey = "name" | "rating" | "recency";

function avgRating(r: RestaurantFull): number {
  const scores = Object.values(r.ratings);
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}

export function RestaurantList({
  restaurants,
  home,
}: {
  restaurants: RestaurantFull[];
  home: LatLng;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [view, setView] = useState<"active" | "wishlist">("active");
  const [mode, setMode] = useState<"list" | "map">("list");
  const [pending, startTransition] = useTransition();
  const [loggedId, setLoggedId] = useState<string | null>(null);
  const hasHome = home.lat !== null && home.lng !== null;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return restaurants
      .filter((r) => r.status === view)
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.cuisines.some((c) => c.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        if (sort === "rating") return avgRating(b) - avgRating(a);
        if (sort === "recency") {
          return (a.lastVisitAt ?? "0000").localeCompare(b.lastVisitAt ?? "0000");
        }
        return a.name.localeCompare(b.name);
      });
  }, [restaurants, query, sort, view]);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Our places</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode(mode === "list" ? "map" : "list")}
            className="rounded-xl border border-border-soft bg-surface-2 px-3 py-2 text-sm font-semibold"
          >
            {mode === "list" ? "🗺️ Map" : "📋 List"}
          </button>
          <Link
            href="/restaurants/new"
            className="rounded-xl bg-accent px-4 py-2 font-bold text-black"
          >
            + Add
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Link href="/restaurants/duplicates" className="text-sm text-accent underline">
          🔁 Find duplicates
        </Link>
        <Link href="/insights" className="text-sm text-accent underline">
          📊 Insights
        </Link>
      </div>

      {mode === "map" ? (
        <MapView restaurants={restaurants} home={home} />
      ) : (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or cuisine…"
            className="rounded-xl border border-border-soft bg-surface px-4 py-2.5 outline-none focus:border-accent"
          />

      <div className="flex flex-wrap gap-2">
        <Chip active={view === "active"} onClick={() => setView("active")}>
          🍽️ Been there ({restaurants.filter((r) => r.status === "active").length})
        </Chip>
        <Chip active={view === "wishlist"} onClick={() => setView("wishlist")}>
          ⭐ Wishlist ({restaurants.filter((r) => r.status === "wishlist").length})
        </Chip>
        <span className="flex-1" />
        <Chip active={sort === "name"} onClick={() => setSort("name")}>
          A→Z
        </Chip>
        <Chip active={sort === "rating"} onClick={() => setSort("rating")}>
          Top rated
        </Chip>
        <Chip active={sort === "recency"} onClick={() => setSort("recency")}>
          Longest ago
        </Chip>
      </div>

      <ul className="flex flex-col gap-2">
        {shown.map((r) => {
          const days = daysSince(r.lastVisitAt);
          const avg = avgRating(r);
          const dist = hasHome ? formatMiles(distanceMiles(home, r)) : null;
          return (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface p-3"
            >
              <Link href={`/restaurants/${r.id}`} className="min-w-0 flex-1">
                <p className="truncate font-bold">{r.name}</p>
                <p className="truncate text-sm text-muted">
                  {r.cuisines.join(" · ") || "uncategorized"} · {PRICE_LABELS[r.price - 1]}
                  {avg > 0 && ` · ★ ${avg.toFixed(1)}`}
                  {dist && ` · ${dist}`}
                  {days !== null && ` · ${days}d ago`}
                </p>
              </Link>
              {view === "wishlist" ? (
                <button
                  disabled={pending}
                  onClick={() => startTransition(() => setStatusAction(r.id, "active"))}
                  className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold"
                  title="Move to Been there"
                >
                  ✓ Been
                </button>
              ) : loggedId === r.id ? (
                <span className="rounded-lg bg-green-950/60 px-3 py-2 text-sm font-semibold text-green-300">
                  Logged 🎉
                </span>
              ) : (
                <button
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await logVisitAction(r.id, "dine_in");
                      setLoggedId(r.id);
                    })
                  }
                  className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold"
                  title="One-tap: we ate here today"
                >
                  +1 visit
                </button>
              )}
            </li>
          );
        })}
        {shown.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border-soft p-8 text-center text-muted">
            {view === "wishlist"
              ? "Nothing on the wishlist yet. Add places you want to try!"
              : "No matches. Add your first restaurant with the + Add button."}
          </li>
        )}
      </ul>
        </>
      )}
    </div>
  );
}
