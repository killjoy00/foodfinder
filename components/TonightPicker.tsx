"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CuisineRecency,
  DEFAULT_FILTERS,
  PickerFilters,
  WeightedCandidate,
  buildCandidates,
  collapseChains,
  pickTonight,
  sampleCandidates,
  wheelSegments,
} from "@/lib/picker";
import {
  Profile,
  RestaurantFull,
  TAGS,
  TAG_LABELS,
  Tag,
  isSpecialCuisine,
  specialCuisineEmoji,
} from "@/lib/types";
import { LatLng, distanceMiles, formatMiles } from "@/lib/distance";
import { logVisitAction, startVoteAction } from "@/app/actions";
import { SpinWheel } from "./SpinWheel";
import { ResultCard } from "./ResultCard";
import { Chip, Segmented } from "./ui";

type Phase = "idle" | "spinning" | "result";

const NEAR_ME_CHOICES = [1, 3, 5, 10];

export function TonightPicker({
  restaurants,
  profiles,
  cuisineRecency,
  allCuisines,
  home,
}: {
  restaurants: RestaurantFull[];
  profiles: Profile[];
  cuisineRecency: CuisineRecency;
  allCuisines: string[];
  home: LatLng;
}) {
  const [filters, setFilters] = useState<PickerFilters>(DEFAULT_FILTERS);
  const [phase, setPhase] = useState<Phase>("idle");
  const [winner, setWinner] = useState<WeightedCandidate | null>(null);
  const [segments, setSegments] = useState<WeightedCandidate[]>([]);
  const [spinKey, setSpinKey] = useState(0);
  const [logged, setLogged] = useState(false);
  const [, startVoteTransition] = useTransition();

  const [nearMe, setNearMe] = useState(false);
  const [deviceOrigin, setDeviceOrigin] = useState<LatLng | null>(null);
  const [maxDistance, setMaxDistance] = useState(10);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  // distances are measured from where you are (near-me) or from home
  const origin: LatLng | null = nearMe && deviceOrigin ? deviceOrigin : home;
  const hasOrigin = origin?.lat !== null && origin?.lng !== null;

  function distanceOf(r: RestaurantFull): number | null {
    return distanceMiles(origin, r);
  }

  // when near-me is on with a fix, drop places that are out of range or unlocated
  const usable = useMemo(() => {
    if (!nearMe || !deviceOrigin) return restaurants;
    return restaurants.filter((r) => {
      const d = distanceMiles(deviceOrigin, r);
      return d !== null && d <= maxDistance;
    });
  }, [restaurants, nearMe, deviceOrigin, maxDistance]);

  // chains (same name, multiple locations) collapse to one entry; the
  // representative is the nearest location to wherever "here" is
  const collapsed = useMemo(() => collapseChains(usable, origin), [usable, origin]);

  const { regulars, wishlist } = useMemo(
    () => buildCandidates(collapsed, filters, cuisineRecency),
    [collapsed, filters, cuisineRecency]
  );
  const eligibleCount = regulars.length + wishlist.length;

  function enableNearMe() {
    if (!("geolocation" in navigator)) {
      setGeoMsg("This device can't share its location.");
      return;
    }
    setGeoMsg("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeviceOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNearMe(true);
        setGeoMsg(null);
        setFilters((f) => ({ ...f, excludeIds: [] }));
      },
      () => setGeoMsg("Couldn't get your location — check the browser permission."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function spin(extraExclude?: string) {
    const f = extraExclude
      ? { ...filters, excludeIds: [...filters.excludeIds, extraExclude] }
      : filters;
    if (extraExclude) setFilters(f);
    const candidates = collapseChains(usable, origin);
    const picked = pickTonight(candidates, f, cuisineRecency);
    if (!picked) return;
    // build the wheel pool from THIS spin's candidates so a just-rerolled
    // (excluded) place can't reappear via a stale closure
    const built = buildCandidates(candidates, f, cuisineRecency);
    const pool = [...built.regulars, ...built.wishlist];
    setWinner(picked);
    setSegments(wheelSegments(picked, pool.length > 1 ? pool : [picked]));
    setLogged(false);
    setSpinKey((k) => k + 1);
    setPhase("spinning");
  }

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  // Special cuisines (dessert/coffee/tea) are exclusive: choosing one clears
  // every other cuisine, and choosing a normal cuisine clears any special.
  function toggleCuisine(c: string) {
    const special = isSpecialCuisine(c);
    setFilters((f) => {
      const has = f.cuisines.includes(c);
      let cuisines: string[];
      if (has) cuisines = f.cuisines.filter((x) => x !== c);
      else if (special) cuisines = [c];
      else cuisines = [...f.cuisines.filter((x) => !isSpecialCuisine(x)), c];
      return { ...f, cuisines, excludeIds: [] };
    });
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
              onClick={() => toggleCuisine(c)}
            >
              {specialCuisineEmoji(c) ? `${specialCuisineEmoji(c)} ${c}` : c}
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
            Adventure level —{" "}
            {filters.wishlistPercent === 0
              ? "always a regular spot"
              : filters.wishlistPercent === 100
                ? "only wishlist places 🎈"
                : `${filters.wishlistPercent}% chance of a wishlist place`}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={filters.wishlistPercent}
            onChange={(e) =>
              setFilters({ ...filters, wishlistPercent: parseInt(e.target.value, 10), excludeIds: [] })
            }
            className="accent-orange-500"
          />
          {wishlist.length === 0 && filters.wishlistPercent > 0 && (
            <span className="text-xs text-yellow-300">
              No wishlist places match your filters — add some (⭐ on a restaurant) for this to do anything.
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Avoid repeats —{" "}
            {filters.recencyStrength === 0
              ? "ignore what we ate lately"
              : filters.recencyStrength === 100
                ? "strongly avoid recent spots & cuisines"
                : `${filters.recencyStrength}% nudge away from recent`}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={filters.recencyStrength}
            onChange={(e) =>
              setFilters({
                ...filters,
                recencyStrength: parseInt(e.target.value, 10),
                excludeIds: [],
              })
            }
            className="accent-orange-500"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Distance</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={geoMsg === "Finding you…"}
              onClick={() => (nearMe ? setNearMe(false) : enableNearMe())}
              className={`rounded-full border px-3 py-1.5 text-sm transition disabled:opacity-50 ${
                nearMe
                  ? "border-accent bg-accent-soft font-semibold text-orange-200"
                  : "border-border-soft bg-surface-2 text-muted"
              }`}
            >
              📍 {geoMsg === "Finding you…" ? "Finding…" : nearMe ? "Near me now" : "Use my location"}
            </button>
            {!hasOrigin && !nearMe && (
              <span className="text-xs text-muted">set home in Settings to show distances</span>
            )}
            {geoMsg && <span className="text-xs text-muted">{geoMsg}</span>}
          </div>
          {nearMe && deviceOrigin && (
            <>
              <Segmented
                options={NEAR_ME_CHOICES.map((mi) => ({ label: `${mi} mi`, value: mi }))}
                value={maxDistance}
                onChange={(mi) => {
                  setMaxDistance(mi);
                  setFilters((f) => ({ ...f, excludeIds: [] }));
                }}
              />
              <p className="text-xs text-muted">
                {usable.length} place{usable.length === 1 ? "" : "s"} within {maxDistance} mi of you
              </p>
            </>
          )}
        </div>

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
          distanceLabel={formatMiles(distanceOf(winner.restaurant))}
          distanceFromMe={nearMe && !!deviceOrigin}
        />
      )}
    </div>
  );
}
