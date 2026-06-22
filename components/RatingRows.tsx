"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearRatingAction, setRatingAction } from "@/app/actions";
import { Profile } from "@/lib/types";

function ratingsKey(r: Record<string, number>): string {
  return Object.entries(r)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(",");
}

export function RatingRows({
  restaurantId,
  profiles,
  ratings,
}: {
  restaurantId: string;
  profiles: Profile[];
  ratings: Record<string, number>;
}) {
  const router = useRouter();
  const [local, setLocal] = useState<Record<string, number | undefined>>(ratings);
  const [isPending, startTransition] = useTransition();

  // Reconcile with the server whenever incoming ratings change (another
  // member rated, a rating was removed, etc.) — but never clobber an edit
  // that's still in flight.
  const serverKey = ratingsKey(ratings);
  useEffect(() => {
    if (!isPending) setLocal(ratings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  // Poll for other devices' changes so ratings update live on this page.
  const pendingRef = useRef(isPending);
  pendingRef.current = isPending;
  useEffect(() => {
    const t = setInterval(() => {
      if (!pendingRef.current) router.refresh();
    }, 6000);
    return () => clearInterval(t);
  }, [router]);

  // tap a number to set it; tap the same number again to clear the rating
  function toggleScore(profileId: string, score: number) {
    setLocal((prev) => {
      const next = prev[profileId] === score ? undefined : score;
      startTransition(() =>
        next === undefined
          ? clearRatingAction(restaurantId, profileId)
          : setRatingAction(restaurantId, profileId, next)
      );
      return { ...prev, [profileId]: next };
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {profiles.map((p) => {
        const score = local[p.id];
        return (
          <div key={p.id} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-sm font-semibold">
              {p.emoji} {p.name}
            </span>
            <div className="flex flex-1 gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => toggleScore(p.id, n)}
                  className={`h-8 flex-1 rounded-md text-[11px] font-bold transition ${
                    score !== undefined && n <= score
                      ? "bg-accent text-black"
                      : "bg-surface-2 text-muted"
                  }`}
                  title={score === n ? "Tap again to clear" : `${n}/10`}
                  aria-label={`${p.name}: rate ${n} of 10`}
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="w-10 text-right text-sm text-muted">
              {score !== undefined ? `${score}/10` : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
