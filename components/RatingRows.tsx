"use client";

import { useState, useTransition } from "react";
import { setRatingAction } from "@/app/actions";
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
  const [local, setLocal] = useState<Record<string, number>>(ratings);
  const [, startTransition] = useTransition();

  function setScore(profileId: string, score: number) {
    setLocal((prev) => ({ ...prev, [profileId]: score }));
    startTransition(() => setRatingAction(restaurantId, profileId, score));
  }

  return (
    <div className="flex flex-col gap-3">
      {profiles.map((p) => {
        const score = local[p.id];
        return (
          <div key={p.id} className="flex items-center gap-2">
            <span className="w-24 shrink-0 truncate text-sm font-semibold">
              {p.emoji} {p.name}
            </span>
            <div className="flex flex-1 gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setScore(p.id, n)}
                  className={`h-7 flex-1 rounded text-[10px] font-bold transition ${
                    score !== undefined && n <= score
                      ? "bg-accent text-black"
                      : "bg-surface-2 text-muted"
                  }`}
                  title={`${n}/10`}
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
