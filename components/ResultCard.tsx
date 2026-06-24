"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { DEFAULT_VOTE_SIZE, VOTE_SIZE_CHOICES, WeightedCandidate } from "@/lib/picker";
import { PRICE_LABELS, Profile, VisitMode, daysSince, mapsLink, openTableLink } from "@/lib/types";

export function ResultCard({
  candidate,
  profiles,
  logged,
  onLog,
  onReroll,
  onStartVote,
  maxVoteSize,
  distanceLabel,
  distanceFromMe,
}: {
  candidate: WeightedCandidate;
  profiles: Profile[];
  logged: boolean;
  onLog: (mode: VisitMode) => Promise<void>;
  onReroll: () => void;
  onStartVote: (count: number) => void;
  maxVoteSize: number;
  distanceLabel: string | null;
  distanceFromMe: boolean;
}) {
  const r = candidate.restaurant;
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<VisitMode>("dine_in");
  const [choosingVoteSize, setChoosingVoteSize] = useState(false);
  const days = daysSince(r.lastVisitAt);
  const voteSizes = VOTE_SIZE_CHOICES.filter((n) => n <= maxVoteSize);

  return (
    <section className="pop-in flex flex-col gap-4 rounded-2xl border-2 border-accent bg-surface p-5 shadow-xl">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">Tonight you eat at</p>
        <h2 className="text-3xl font-extrabold leading-tight">{r.name}</h2>
        <p className="mt-1 text-muted">
          {r.cuisines.join(" · ")} {r.cuisines.length > 0 && "·"} {PRICE_LABELS[r.price - 1]}
          {distanceLabel ? ` · ${distanceLabel}${distanceFromMe ? " away" : " from home"}` : ""}
          {days !== null
            ? ` · last visit ${days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`}`
            : r.status === "wishlist"
              ? " · first time! 🎈"
              : ""}
        </p>
        {r.locationCount > 1 && (
          <p className="mt-1 text-sm text-orange-200">
            📍 Nearest of {r.locationCount} locations{r.address ? ` · ${r.address}` : ""}
          </p>
        )}
      </div>

      {candidate.reasons.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {candidate.reasons.map((reason) => (
            <span
              key={reason}
              className="rounded-full bg-surface-2 px-3 py-1 text-xs text-orange-200"
            >
              {reason}
            </span>
          ))}
        </div>
      )}

      {Object.keys(r.ratings).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {profiles
            .filter((p) => r.ratings[p.id] !== undefined)
            .map((p) => (
              <span
                key={p.id}
                className="rounded-full border border-border-soft px-3 py-1 text-sm"
                title={`${p.name}'s rating`}
              >
                {p.emoji} {r.ratings[p.id]}/10
              </span>
            ))}
        </div>
      )}

      <div className="flex gap-2">
        <a
          href={mapsLink(r)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-xl bg-surface-2 px-4 py-3 text-center font-semibold"
        >
          🗺️ Maps
        </a>
        <a
          href={openTableLink(r)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-xl bg-surface-2 px-4 py-3 text-center font-semibold"
        >
          🪑 Reserve
        </a>
        <Link
          href={`/restaurants/${r.id}`}
          className="flex-1 rounded-xl bg-surface-2 px-4 py-3 text-center font-semibold"
        >
          📄 Details
        </Link>
      </div>

      {logged ? (
        <p className="rounded-xl bg-green-950/60 px-4 py-3 text-center font-semibold text-green-300">
          Logged — enjoy dinner! 🎉
        </p>
      ) : (
        <div className="flex items-stretch gap-2">
          <button
            onClick={() => setMode(mode === "dine_in" ? "takeout" : "dine_in")}
            className="rounded-xl border border-border-soft bg-surface-2 px-3 text-xl"
            title="Toggle dine in / takeout"
            aria-label={`Logging as ${mode === "dine_in" ? "dine in" : "takeout"} — tap to switch`}
          >
            {mode === "dine_in" ? "🍽️" : "🥡"}
          </button>
          <button
            disabled={pending}
            onClick={() => startTransition(() => onLog(mode))}
            className="flex-1 rounded-xl bg-accent px-4 py-3 text-lg font-bold text-black disabled:opacity-50"
          >
            {pending ? "Logging…" : "We went! Log it 🎉"}
          </button>
        </div>
      )}

      {choosingVoteSize ? (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-muted">How many options?</span>
          {voteSizes.map((n) => (
            <button
              key={n}
              onClick={() => onStartVote(n)}
              className={`h-10 flex-1 rounded-xl border font-bold ${
                n === DEFAULT_VOTE_SIZE
                  ? "border-accent bg-accent-soft text-orange-200"
                  : "border-border-soft text-muted"
              }`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setChoosingVoteSize(false)}
            className="rounded-xl border border-border-soft px-3 py-2 text-muted"
            title="Never mind"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={onReroll}
            className="flex-1 rounded-xl border border-border-soft px-4 py-2 font-semibold text-muted"
          >
            😒 Nope, spin again
          </button>
          <button
            onClick={() =>
              voteSizes.length > 1 ? setChoosingVoteSize(true) : onStartVote(DEFAULT_VOTE_SIZE)
            }
            className="flex-1 rounded-xl border border-border-soft px-4 py-2 font-semibold text-muted"
          >
            🗳️ Let the family vote
          </button>
        </div>
      )}
    </section>
  );
}
