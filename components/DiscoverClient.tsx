"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  RecommendationGroup,
  addDiscoveryToWishlistAction,
  addRecommendationToWishlistAction,
  dismissDiscoveryAction,
  fetchRecommendationsAction,
  runSweepAction,
} from "@/app/actions";
import { Discovery } from "@/lib/types";

export function DiscoverClient({
  discoveries,
  hasKey,
  hasHome,
}: {
  discoveries: Discovery[];
  hasKey: boolean;
  hasHome: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [recs, setRecs] = useState<RecommendationGroup[] | null>(null);
  const [recError, setRecError] = useState<string | null>(null);
  const [sweepMsg, setSweepMsg] = useState<string | null>(null);
  const [addedRecs, setAddedRecs] = useState<Set<string>>(new Set());

  const ready = hasKey && hasHome;

  function loadRecs() {
    setRecError(null);
    startTransition(async () => {
      const result = await fetchRecommendationsAction();
      if (result.ok) setRecs(result.groups);
      else setRecError(result.error);
    });
  }

  function sweepNow() {
    setSweepMsg(null);
    startTransition(async () => {
      const result = await runSweepAction();
      setSweepMsg(
        result.ok
          ? result.baseline
            ? `Baseline recorded (${result.seen} places). New openings will show up on future sweeps.`
            : `Swept ${result.seen} places — ${result.added} new.`
          : result.error
      );
    });
  }

  return (
    <div className="flex flex-col gap-5 pt-2">
      <h1 className="text-2xl font-bold">Discover ✨</h1>

      {!ready && (
        <p className="rounded-xl border border-border-soft bg-surface p-4 text-sm text-muted">
          To unlock new-restaurant alerts and personalized recommendations,{" "}
          {!hasKey && "add a GOOGLE_PLACES_API_KEY (see DEPLOY.md)"}
          {!hasKey && !hasHome && " and "}
          {!hasHome && (
            <>
              set your home location in{" "}
              <Link href="/settings" className="text-accent underline">
                Settings
              </Link>
            </>
          )}
          . Everything else works without it.
        </p>
      )}

      {/* new openings */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Newly spotted nearby</h2>
          {ready && (
            <button
              onClick={sweepNow}
              disabled={pending}
              className="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
            >
              {pending ? "Working…" : "Sweep now"}
            </button>
          )}
        </div>
        {sweepMsg && <p className="text-sm text-muted">{sweepMsg}</p>}
        {discoveries.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-soft p-6 text-center text-sm text-muted">
            Nothing new yet. The weekly sweep flags restaurants that pop up near home.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {discoveries.map((d) => (
              <li
                key={d.placeId}
                className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{d.name}</p>
                  <p className="truncate text-sm text-muted">
                    {d.rating ? `★ ${d.rating.toFixed(1)} · ` : ""}
                    {d.address ?? ""}
                  </p>
                </div>
                <button
                  disabled={pending}
                  onClick={() => startTransition(() => addDiscoveryToWishlistAction(d.placeId))}
                  className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-black"
                >
                  ⭐ Wishlist
                </button>
                <button
                  disabled={pending}
                  onClick={() => startTransition(() => dismissDiscoveryAction(d.placeId))}
                  className="rounded-lg bg-surface-2 px-3 py-2 text-sm"
                  title="Not interested"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* recommendations */}
      <section className="flex flex-col gap-3">
        <h2 className="font-bold">Picked for your family</h2>
        <p className="text-sm text-muted">
          Based on the cuisines and price range your ratings show you love.
        </p>
        {ready && recs === null && (
          <button
            onClick={loadRecs}
            disabled={pending}
            className="rounded-xl bg-accent px-4 py-3 font-bold text-black disabled:opacity-50"
          >
            {pending ? "Asking Google…" : "🔮 Find recommendations"}
          </button>
        )}
        {recError && <p className="text-sm text-red-400">{recError}</p>}
        {recs !== null && recs.length === 0 && (
          <p className="text-sm text-muted">
            No new matches right now — rate more places to sharpen your taste profile.
          </p>
        )}
        {recs?.map((group) => (
          <div key={group.cuisine}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              Because you love {group.cuisine}
            </h3>
            <ul className="flex flex-col gap-2">
              {group.places.map((p) => (
                <li
                  key={p.placeId}
                  className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{p.name}</p>
                    <p className="truncate text-sm text-muted">
                      {p.rating ? `★ ${p.rating.toFixed(1)} · ` : ""}
                      {p.address ?? ""}
                    </p>
                  </div>
                  {p.mapsUrl && (
                    <a
                      href={p.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-surface-2 px-2 py-2 text-sm"
                    >
                      🗺️
                    </a>
                  )}
                  {addedRecs.has(p.placeId) ? (
                    <span className="rounded-lg bg-green-950/60 px-3 py-2 text-sm font-semibold text-green-300">
                      Added ✓
                    </span>
                  ) : (
                    <button
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await addRecommendationToWishlistAction({
                            placeId: p.placeId,
                            name: p.name,
                            address: p.address,
                            mapsUrl: p.mapsUrl,
                            cuisine: group.cuisine,
                          });
                          setAddedRecs((prev) => new Set(prev).add(p.placeId));
                        })
                      }
                      className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-black"
                    >
                      ⭐ Wishlist
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
