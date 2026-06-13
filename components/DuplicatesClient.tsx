"use client";

import { useState, useTransition } from "react";
import { mergeRestaurantsAction } from "@/app/actions";
import { PRICE_LABELS } from "@/lib/types";

type DupItem = {
  id: string;
  name: string;
  cuisines: string[];
  price: number;
  status: string;
  address: string | null;
  visitCount: number;
  ratingCount: number;
  hasPlaceId: boolean;
};

type DupPair = {
  a: DupItem;
  b: DupItem;
  reason: string;
  confidence: "high" | "medium";
};

function completeness(r: DupItem): number {
  return r.visitCount + r.ratingCount + (r.hasPlaceId ? 1 : 0) + r.cuisines.length;
}

export function DuplicatesClient({ pairs }: { pairs: DupPair[] }) {
  const [pending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  function merge(survivor: DupItem, loser: DupItem) {
    startTransition(async () => {
      await mergeRestaurantsAction(survivor.id, loser.id);
      // any pair touching the removed restaurant is now resolved
      setDoneIds((prev) => new Set(prev).add(loser.id));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Merging keeps every visit and rating, unions cuisines and tags, and removes the other entry.
        Pick which one to keep.
      </p>
      {pairs.map((pair, idx) => {
        if (dismissed.has(idx) || doneIds.has(pair.a.id) || doneIds.has(pair.b.id)) return null;
        const suggested =
          completeness(pair.a) >= completeness(pair.b) ? pair.a.id : pair.b.id;
        return (
          <div key={idx} className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-surface p-4">
            <div className="flex items-center justify-between">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  pair.confidence === "high"
                    ? "bg-accent-soft text-orange-200"
                    : "bg-surface-2 text-muted"
                }`}
              >
                {pair.confidence === "high" ? "Likely" : "Maybe"} · {pair.reason}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[pair.a, pair.b].map((r, side) => {
                const other = side === 0 ? pair.b : pair.a;
                return (
                  <div
                    key={r.id}
                    className={`flex flex-col gap-2 rounded-xl border p-3 ${
                      suggested === r.id ? "border-accent" : "border-border-soft"
                    }`}
                  >
                    <div>
                      <p className="font-bold leading-tight">{r.name}</p>
                      <p className="text-xs text-muted">
                        {r.cuisines.join(", ") || "—"} · {PRICE_LABELS[r.price - 1]}
                        {r.status === "wishlist" ? " · ⭐" : ""}
                      </p>
                      {r.address && <p className="truncate text-xs text-muted">{r.address}</p>}
                      <p className="text-xs text-muted">
                        {r.visitCount} visit{r.visitCount === 1 ? "" : "s"} · {r.ratingCount} rating
                        {r.ratingCount === 1 ? "" : "s"}
                        {suggested === r.id ? " · most complete" : ""}
                      </p>
                    </div>
                    <button
                      disabled={pending}
                      onClick={() => merge(r, other)}
                      className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-black disabled:opacity-50"
                    >
                      Keep this, merge other
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setDismissed((prev) => new Set(prev).add(idx))}
              className="text-xs text-muted underline"
            >
              These aren&apos;t duplicates
            </button>
          </div>
        );
      })}
    </div>
  );
}
