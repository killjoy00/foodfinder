"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DEFAULT_FILTERS,
  PickerFilters,
  WeightedCandidate,
  buildCandidates,
  pickTonight,
  sampleCandidates,
  wheelSegments,
} from "@/lib/picker";
import { Profile, RestaurantFull, TAGS, TAG_LABELS, Tag } from "@/lib/types";
import { logVisitAction, startVoteAction } from "@/app/actions";
import { SpinWheel } from "./SpinWheel";
import { ResultCard } from "./ResultCard";
import { Chip, Segmented } from "./ui";

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

  function startVote(count: number) {
    // keep the restaurant we just spun as one of the options, then fill the
    // rest of the ballot with other weighted candidates
    const pool = [...regulars, ...wishlist];
    const seeded = winner
      ? [winner, ...sampleCandidates(
          pool.filter((c) => c.restaurant.id !== winner.restaurant.id),
          count - 1
        )]
      : sampleCandidates(pool, count);
    if (seeded.length >= 2) {
      startVoteTransition(() => startVoteAction(seeded.map((c) => c.restaurant.id)));
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
              <span
                className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full align-middle text-xs"
                style={{ backgroundColor: p.color }}
              >
                {p.emoji}
              </span>
              {p.name}
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

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Vibe</span>
            <Segmented
              options={[
                { label: "🍽️ Dine in", value: "dine_in" },
                { label: "🥡 Takeout", value: "takeout" },
              ]}
              value={filters.mode}
              onChange={(mode) => setFilters({ ...filters, mode, excludeIds: [] })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Max price
            </span>
            <Segmented
              options={[1, 2, 3, 4].map((p) => ({ label: "$".repeat(p), value: p }))}
              value={filters.maxPrice}
              onChange={(maxPrice) => setFilters({ ...filters, maxPrice, excludeIds: [] })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Quality bar — lowest rating allowed on the wheel
          </span>
          <Segmented
            options={[
              { label: "Any", value: 0 },
              ...[5, 6, 7, 8].map((n) => ({ label: `${n}+`, value: n })),
            ]}
            value={filters.minScore}
            onChange={(minScore) => setFilters({ ...filters, minScore, excludeIds: [] })}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-full text-xs font-semibold uppercase tracking-wide text-muted">
            Must have
          </span>
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
          maxVoteSize={eligibleCount}
        />
      )}
    </div>
  );
}
