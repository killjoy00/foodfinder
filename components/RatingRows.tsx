"use client";

import { useState, useTransition } from "react";
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
  const [local, setLocal] = useState<Record<string, number | undefined>>(ratings);
  const [, startTransition] = useTransition();

  // tap a number to set it; tap the same number again to clear the rating
  function toggleScore(profileId: string, score: number) {
    setLocal((prev) => {
      const current = prev[profileId];
      const next = current === score ? undefined : score;
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
