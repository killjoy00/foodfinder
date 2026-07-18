"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { trackRestaurantsBulkAction } from "@/app/actions";
import { Chip } from "./ui";

type StarterEntry = { id: string; cuisines: string[]; tracked: boolean };

export function StartClient({
  groupName,
  trackedCount,
  catalog,
}: {
  groupName: string;
  trackedCount: number;
  catalog: StarterEntry[];
}) {
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [addedByCuisine, setAddedByCuisine] = useState<number | null>(null);
  const [addedAll, setAddedAll] = useState<number | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [pending, startTransition] = useTransition();

  const untracked = useMemo(() => catalog.filter((c) => !c.tracked), [catalog]);

  const cuisineCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of untracked)
      for (const cuisine of c.cuisines) counts.set(cuisine, (counts.get(cuisine) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [untracked]);

  const matchingIds = useMemo(() => {
    if (chosen.size === 0) return [];
    return untracked.filter((c) => c.cuisines.some((x) => chosen.has(x))).map((c) => c.id);
  }, [untracked, chosen]);

  function toggle(cuisine: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(cuisine)) next.delete(cuisine);
      else next.add(cuisine);
      return next;
    });
  }

  function addByCuisine() {
    startTransition(async () => {
      setAddedByCuisine(await trackRestaurantsBulkAction(matchingIds, "wishlist"));
      setChosen(new Set());
    });
  }

  function addEverything() {
    startTransition(async () => {
      setAddedAll(
        await trackRestaurantsBulkAction(
          untracked.map((c) => c.id),
          "wishlist"
        )
      );
      setConfirmAll(false);
    });
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {groupName}! 🎉</h1>
        <p className="text-sm text-muted">
          {trackedCount === 0
            ? "Let's get some restaurants on your list — pick whichever way suits you (you can mix and match)."
            : `Your list has ${trackedCount} spot${trackedCount === 1 ? "" : "s"} so far — here are more ways to grow it.`}
        </p>
      </div>

      <section className="flex flex-col gap-2 rounded-2xl border border-accent bg-accent-soft/20 p-4">
        <h2 className="font-bold">🔎 Browse and hand-pick</h2>
        <p className="text-sm text-muted">
          Flip through the {catalog.length ? `${catalog.length}-restaurant ` : ""}shared catalog
          with search, distance, and neighborhood filters — tap the ones your family knows.
        </p>
        <Link
          href="/restaurants/browse"
          className="self-start rounded-xl bg-accent px-4 py-2.5 font-bold text-black"
        >
          Browse the catalog →
        </Link>
      </section>

      {cuisineCounts.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-4">
          <h2 className="font-bold">🍜 Add whole cuisines</h2>
          <p className="text-sm text-muted">
            Pick the cuisines your family eats — everything matching lands on your wishlist to
            rate and triage later.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {cuisineCounts.slice(0, 24).map(([cuisine, n]) => (
              <Chip key={cuisine} active={chosen.has(cuisine)} onClick={() => toggle(cuisine)}>
                {cuisine} ({n})
              </Chip>
            ))}
          </div>
          {matchingIds.length > 0 && (
            <button
              onClick={addByCuisine}
              disabled={pending}
              className="self-start rounded-xl bg-accent px-4 py-2.5 font-bold text-black disabled:opacity-50"
            >
              {pending ? "Adding…" : `⭐ Add ${matchingIds.length} to wishlist`}
            </button>
          )}
          {addedByCuisine !== null && (
            <p className="rounded-xl bg-green-950/60 px-4 py-3 text-sm font-semibold text-green-300">
              Added {addedByCuisine} restaurant{addedByCuisine === 1 ? "" : "s"} to your wishlist. 🎉
            </p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-4">
        <h2 className="font-bold">📥 Import from Google Maps</h2>
        <p className="text-sm text-muted">
          Already have starred places and reviews in Google Maps? Import them — your ratings come
          along.
        </p>
        <Link
          href="/import"
          className="self-start rounded-xl bg-surface-2 px-4 py-2.5 font-semibold"
        >
          Import Google Takeout →
        </Link>
      </section>

      {untracked.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-4">
          <h2 className="font-bold">🌊 Add everything</h2>
          <p className="text-sm text-muted">
            Put all {untracked.length} catalog restaurants on your wishlist. It&apos;s a lot — the
            picker and votes work better with a curated list, but this works if you like pruning
            more than picking.
          </p>
          {confirmAll ? (
            <div className="flex gap-2">
              <button
                onClick={addEverything}
                disabled={pending}
                className="rounded-xl bg-accent px-4 py-2.5 font-bold text-black disabled:opacity-50"
              >
                {pending ? "Adding…" : `Yes, add all ${untracked.length}`}
              </button>
              <button
                onClick={() => setConfirmAll(false)}
                disabled={pending}
                className="rounded-xl bg-surface-2 px-4 py-2.5 font-semibold"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmAll(true)}
              className="self-start rounded-xl bg-surface-2 px-4 py-2.5 font-semibold"
            >
              Add the whole catalog…
            </button>
          )}
          {addedAll !== null && (
            <p className="rounded-xl bg-green-950/60 px-4 py-3 text-sm font-semibold text-green-300">
              Added {addedAll} restaurant{addedAll === 1 ? "" : "s"} to your wishlist. 🎉
            </p>
          )}
        </section>
      )}

      <Link href="/" className="self-center pb-4 text-sm text-muted underline">
        Skip for now — take me to the app
      </Link>
    </div>
  );
}
