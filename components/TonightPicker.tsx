"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DEFAULT_FILTERS,
  PickerFilters,
  WeightedCandidate,
  buildCandidates,
  pickTonight,
  pickWeighted,
  wheelSegments,
} from "@/lib/picker";
import { Profile, RestaurantFull, TAGS, TAG_LABELS, Tag } from "@/lib/types";
import { logVisitAction, startVoteAction } from "@/app/actions";
import { SpinWheel } from "./SpinWheel";
import { ResultCard } from "./ResultCard";
import { Chip } from "./ui";

type Phase = "idle" | "spinning" | "result";

export function TonightPicker({
  restaurants,
  profiles,
  recentVisitCuisines,
  allCuisines,
}: {
  restaurants: RestaurantFull[];
  profiles: Profile[];
  recentVisitCuisines: string[][];
  allCuisines: string[];
}) {
  const [filters, setFilters] = useState<PickerFilters>(DEFAULT_FILTERS);
  const [phase, setPhase] = useState<Phase>("idle");
  const [winner, setWinner] = useState<WeightedCandidate | null>(null);
  const [segments, setSegments] = useState<WeightedCandidate[]>([]);
  const [spinKey, setSpinKey] = useState(0);
  const [logged, setLogged] = useState(false);
  const [, startVoteTransition] = useTransition();

  const { regulars, wishlist } = useMemo(
    () => buildCandidates(restaurants, filters, recentVisitCuisines),
    [restaurants, filters, recentVisitCuisines]
  );
  const eligibleCount = regulars.length + wishlist.length;

  function spin(extraExclude?: string) {
    const f = extraExclude
      ? { ...filters, excludeIds: [...filters.excludeIds, extraExclude] }
      : filters;
    if (extraExclude) setFilters(f);
    const picked = pickTonight(restaurants, f, recentVisitCuisines);
    if (!picked) return;
    const pool = [...buildCandidates(restaurants, f, recentVisitCuisines).regulars, ...wishlist];
    setWinner(picked);
    setSegments(wheelSegments(picked, pool.length > 1 ? pool : [picked]));
    setLogged(false);
    setSpinKey((k) => k + 1);
    setPhase("spinning");
  }

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  function startVote() {
    const pool = [...regulars, ...wishlist].filter((c) => c.weight > 0);
    const candidates: WeightedCandidate[] = [];
    const remaining = [...pool];
    while (candidates.length < 3 && remaining.length > 0) {
      const pick = pickWeighted(remaining);
      if (!pick) break;
      candidates.push(pick);
      remaining.splice(remaining.indexOf(pick), 1);
    }
    if (candidates.length >= 2) {
      startVoteTransition(() => startVoteAction(candidates.map((c) => c.restaurant.id)));
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="text-2xl font-bold">Where to tonight?</h1>

      {/* filters */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-full text-xs font-semibold uppercase tracking-wide text-muted">
            Who&apos;s eating
          </span>
          {profiles.map((p) => (
            <Chip
              key={p.id}
              active={filters.eaterIds.includes(p.id)}
              onClick={() =>
                setFilters({ ...filters, eaterIds: toggle(filters.eaterIds, p.id), excludeIds: [] })
              }
            >
              {p.emoji} {p.name}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-full text-xs font-semibold uppercase tracking-wide text-muted">
            Cuisine <span className="normal-case">(any if none picked)</span>
          </span>
          {allCuisines.map((c) => (
            <Chip
              key={c}
              active={filters.cuisines.includes(c)}
              onClick={() =>
                setFilters({ ...filters, cuisines: toggle(filters.cuisines, c), excludeIds: [] })
              }
            >
              {c}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="w-full text-xs font-semibold uppercase tracking-wide text-muted">
            Vibe
          </span>
          <Chip
            active={filters.mode === "dine_in"}
            onClick={() => setFilters({ ...filters, mode: "dine_in", excludeIds: [] })}
          >
            🍽️ Dine in
          </Chip>
          <Chip
            active={filters.mode === "takeout"}
            onClick={() => setFilters({ ...filters, mode: "takeout", excludeIds: [] })}
          >
            🥡 Takeout
          </Chip>
          {[1, 2, 3, 4].map((p) => (
            <Chip
              key={p}
              active={filters.maxPrice === p}
              onClick={() => setFilters({ ...filters, maxPrice: p, excludeIds: [] })}
            >
              {"$".repeat(p)}
              {p < 4 ? " max" : ""}
            </Chip>
          ))}
          {TAGS.map((tag: Tag) => (
            <Chip
              key={tag}
              active={filters.tags.includes(tag)}
              onClick={() =>
                setFilters({ ...filters, tags: toggle(filters.tags, tag), excludeIds: [] })
              }
            >
              {TAG_LABELS[tag]}
            </Chip>
          ))}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Adventure level — {filters.wishlistPercent}% chance of somewhere new
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={filters.wishlistPercent}
            onChange={(e) =>
              setFilters({ ...filters, wishlistPercent: parseInt(e.target.value, 10) })
            }
            className="accent-orange-500"
          />
        </label>

        <p className="text-xs text-muted">
          {eligibleCount} place{eligibleCount === 1 ? "" : "s"} match
          {eligibleCount === 1 ? "es" : ""} ({wishlist.length} on the wishlist)
        </p>
      </section>

      {/* the wheel / result */}
      {phase === "idle" && (
        <button
          onClick={() => spin()}
          disabled={eligibleCount === 0}
          className="rounded-2xl bg-accent px-6 py-5 text-xl font-bold text-black shadow-lg transition active:scale-95 disabled:opacity-40"
        >
          🎡 Spin the wheel
        </button>
      )}

      {phase !== "idle" && winner && (
        <SpinWheel
          segments={segments.map((s) => ({ id: s.restaurant.id, label: s.restaurant.name }))}
          winnerId={winner.restaurant.id}
          spinKey={spinKey}
          onDone={() => setPhase("result")}
        />
      )}

      {phase === "result" && winner && (
        <ResultCard
          candidate={winner}
          profiles={profiles}
          logged={logged}
          onLog={async (mode) => {
            await logVisitAction(winner.restaurant.id, mode);
            setLogged(true);
          }}
          onReroll={() => spin(winner.restaurant.id)}
          onStartVote={startVote}
        />
      )}
    </div>
  );
}
