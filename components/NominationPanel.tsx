"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelVoteAction,
  nominateAction,
  nominateNewPlaceAction,
  openVotingAction,
  removeNominationAction,
  spinNominationsAction,
} from "@/app/actions";
import { nominationCandidates } from "@/lib/vote";
import {
  NOMINATIONS_PER_PROFILE,
  Nomination,
  PRICE_LABELS,
  Profile,
  RestaurantFull,
  VoteSession,
} from "@/lib/types";
import { SpinWheel, WheelSegment } from "./SpinWheel";

type PlaceSuggestion = {
  placeId: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  priceLevel: number | null;
  mapsUrl: string | null;
  cuisines: string[];
};

export function NominationPanel({
  session,
  nominations,
  profiles,
  restaurants,
  activeProfile,
}: {
  session: VoteSession;
  nominations: Nomination[];
  profiles: Profile[];
  restaurants: RestaurantFull[];
  activeProfile: Profile;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [spin, setSpin] = useState<{ winnerId: string; segments: WheelSegment[] } | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // family members nominate from their own phones — keep this page fresh
  useEffect(() => {
    // pause while the wheel is up or an action is in flight, so a refresh
    // can't swap the page out from under the animation
    if (spin || pending) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [router, spin, pending]);

  const byId = useMemo(() => new Map(restaurants.map((r) => [r.id, r])), [restaurants]);
  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const candidates = nominationCandidates(nominations, NOMINATIONS_PER_PROFILE);
  const nominatedIds = new Set(candidates.map((c) => c.brandId));
  const mine = nominations.filter((n) => n.profileId === activeProfile.id);
  const slotsLeft = Math.max(0, NOMINATIONS_PER_PROFILE - mine.length);

  const q = query.trim().toLowerCase();
  const matches =
    q.length >= 1
      ? restaurants
          .filter((r) => !nominatedIds.has(r.id) && r.name.toLowerCase().includes(q))
          .slice(0, 6)
      : [];

  // Google autocomplete for places the family doesn't track yet (best-effort;
  // returns nothing when no Places key is configured)
  useEffect(() => {
    const term = query.trim();
    if (term.length < 3) {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(term)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.places ?? []);
        }
      } catch {
        // autocomplete is best-effort
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(debounce.current);
  }, [query]);

  function nominate(brandId: string) {
    setQuery("");
    setSuggestions([]);
    startTransition(async () => {
      await nominateAction(session.id, brandId);
      router.refresh();
    });
  }

  function nominateNew(place: PlaceSuggestion | { name: string }) {
    setQuery("");
    setSuggestions([]);
    startTransition(async () => {
      await nominateNewPlaceAction(session.id, {
        name: place.name,
        address: "address" in place ? place.address : null,
        lat: "lat" in place ? place.lat : null,
        lng: "lng" in place ? place.lng : null,
        googlePlaceId: "placeId" in place ? place.placeId : null,
        mapsUrl: "mapsUrl" in place ? place.mapsUrl : null,
        priceLevel: "priceLevel" in place ? place.priceLevel : null,
        cuisines: "cuisines" in place ? place.cuisines : [],
      });
      router.refresh();
    });
  }

  function letTheWheelDecide() {
    startTransition(async () => {
      const result = await spinNominationsAction(session.id);
      if (!result) {
        router.refresh();
        return;
      }
      const segments = result.segmentIds.map((id) => ({
        id,
        label: byId.get(id)?.name ?? "…",
      }));
      setSpin({ winnerId: result.winnerId, segments });
    });
  }

  if (spin) {
    return (
      <div className="flex flex-col gap-4 pt-2">
        <h1 className="text-center text-2xl font-bold">The wheel decides 🎡</h1>
        <SpinWheel
          segments={spin.segments}
          winnerId={spin.winnerId}
          spinKey={1}
          onDone={() => router.refresh()}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="text-2xl font-bold">Everyone nominates 🙋</h1>
      <p className="text-sm text-muted">
        Each of you can put up to {NOMINATIONS_PER_PROFILE} places on tonight&apos;s ballot — from
        the family list or somewhere brand new. Then vote on it, or let the wheel decide.
      </p>

      {/* the ballot so far */}
      <div className="flex flex-col gap-3">
        {candidates.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border-soft p-4 text-center text-sm text-muted">
            No nominations yet — you first!
          </p>
        )}
        {candidates.map((c) => {
          const r = byId.get(c.brandId);
          const iNominated = c.nominatorIds.includes(activeProfile.id);
          return (
            <div
              key={c.brandId}
              className="flex items-center gap-3 rounded-2xl border-2 border-border-soft bg-surface p-4"
            >
              <div className="flex-1">
                <p className="text-lg font-bold">{r?.name ?? "…"}</p>
                {r && (
                  <p className="text-sm text-muted">
                    {r.cuisines.join(" · ")}
                    {r.cuisines.length > 0 && " · "}
                    {PRICE_LABELS[r.price - 1]}
                  </p>
                )}
                <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
                  <span>nominated by</span>
                  {c.nominatorIds.map((pid) => {
                    const p = profileById.get(pid);
                    return p ? (
                      <span
                        key={pid}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs"
                        style={{ backgroundColor: p.color }}
                        title={p.name}
                      >
                        {p.emoji}
                      </span>
                    ) : null;
                  })}
                </p>
              </div>
              {iNominated && (
                <button
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await removeNominationAction(session.id, c.brandId);
                      router.refresh();
                    })
                  }
                  className="rounded-lg bg-surface-2 px-2 py-1 text-sm"
                  aria-label={`Remove your nomination of ${r?.name ?? "this place"}`}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* add a nomination */}
      {slotsLeft > 0 ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Your nominations — {slotsLeft} of {NOMINATIONS_PER_PROFILE} left
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your places, or anywhere new…"
            autoComplete="off"
            className="rounded-xl border border-border-soft bg-surface-2 px-3 py-2.5 outline-none focus:border-accent"
          />
          {matches.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border-soft">
              {matches.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  disabled={pending}
                  onClick={() => nominate(r.id)}
                  className="block w-full border-b border-border-soft bg-surface px-3 py-2 text-left text-sm last:border-0 hover:bg-surface-2"
                >
                  <span className="font-semibold">{r.name}</span>
                  <span className="ml-2 text-xs text-muted">
                    {r.status === "wishlist" ? "⭐ wishlist" : r.cuisines.join(" · ")}
                  </span>
                </button>
              ))}
            </div>
          )}
          {searching && <span className="text-xs text-muted">Searching Google…</span>}
          {suggestions.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border-soft">
              <p className="bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
                New places (added to the wishlist)
              </p>
              {suggestions.map((s) => (
                <button
                  type="button"
                  key={s.placeId}
                  disabled={pending}
                  onClick={() => nominateNew(s)}
                  className="block w-full border-b border-border-soft bg-surface px-3 py-2 text-left text-sm last:border-0 hover:bg-surface-2"
                >
                  <span className="font-semibold">{s.name}</span>
                  {s.address && <span className="block truncate text-xs text-muted">{s.address}</span>}
                </button>
              ))}
            </div>
          )}
          {q.length >= 3 && matches.length === 0 && suggestions.length === 0 && !searching && (
            <button
              type="button"
              disabled={pending}
              onClick={() => nominateNew({ name: query.trim() })}
              className="rounded-xl border border-border-soft px-3 py-2 text-left text-sm text-muted hover:bg-surface-2"
            >
              ➕ Add &ldquo;{query.trim()}&rdquo; as a new place and nominate it
            </button>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-center text-sm text-muted">
          You&apos;ve used your {NOMINATIONS_PER_PROFILE} nominations — remove one to swap it.
        </p>
      )}

      {/* who's nominated */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>Nominated:</span>
        {profiles.map((p) => {
          const count = nominations.filter((n) => n.profileId === p.id).length;
          return (
            <span
              key={p.id}
              className={`rounded-full border px-2 py-0.5 ${
                count > 0 ? "border-green-700 text-green-300" : "border-border-soft opacity-50"
              }`}
            >
              {p.emoji} {p.name} {count > 0 ? `✓${count > 1 ? count : ""}` : "…"}
            </span>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() =>
            startTransition(async () => {
              await openVotingAction(session.id);
              router.refresh();
            })
          }
          disabled={pending || candidates.length < 2}
          className="flex-1 rounded-xl bg-accent px-4 py-3 text-lg font-bold text-black disabled:opacity-40"
        >
          🗳️ Start the vote
        </button>
        <button
          onClick={letTheWheelDecide}
          disabled={pending || candidates.length === 0}
          className="flex-1 rounded-xl border border-accent px-4 py-3 font-semibold text-accent disabled:opacity-40"
        >
          🎡 Let the wheel decide
        </button>
      </div>
      {candidates.length < 2 && (
        <p className="text-center text-xs text-muted">
          A vote needs at least two different places on the ballot.
        </p>
      )}
      <button
        onClick={() => startTransition(() => cancelVoteAction(session.id))}
        disabled={pending}
        className="rounded-xl border border-border-soft px-4 py-2 text-muted"
      >
        Cancel
      </button>
    </div>
  );
}
