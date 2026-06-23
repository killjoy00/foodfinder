"use client";

import { startTransition, useOptimistic } from "react";
import { clearRatingAction, setRatingAction } from "@/app/actions";
import { Profile } from "@/lib/types";

export function RatingRows({
  restaurantId,
  profiles,
  ratings,
}: {
  restaurantId: string;
  profiles: Profile[];
  ratings: Record<string, number>;
}) {
  // The server `ratings` prop is the source of truth (it also reflects another
  // member's change once you refresh/navigate). `useOptimistic` overlays the
  // in-flight edit on top of it and — crucially — keeps that overlay alive for
  // exactly the same transition that saves + revalidates, so the handoff back
  // to fresh server state is atomic. That avoids the race the old manual
  // reconcile had, where a second rating could be clobbered back to the first.
  const [optimistic, applyOptimistic] = useOptimistic<
    Record<string, number | undefined>,
    { profileId: string; score: number | undefined }
  >(ratings, (state, { profileId, score }) => ({ ...state, [profileId]: score }));

  // tap a number to set it; tap the same number again to clear the rating
  function toggleScore(profileId: string, score: number) {
    const next = optimistic[profileId] === score ? undefined : score;
    startTransition(async () => {
      applyOptimistic({ profileId, score: next });
      if (next === undefined) {
        await clearRatingAction(restaurantId, profileId);
      } else {
        await setRatingAction(restaurantId, profileId, next);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {profiles.map((p) => {
        const score = optimistic[p.id];
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
