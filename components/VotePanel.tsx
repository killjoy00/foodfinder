"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelVoteAction, castVoteAction, closeVoteAction, logVisitAction } from "@/app/actions";
import { PRICE_LABELS, Profile, RestaurantFull, Vote, VoteSession, daysSince, mapsLink } from "@/lib/types";

export function VotePanel({
  session,
  votes,
  profiles,
  candidates,
  activeProfile,
}: {
  session: VoteSession;
  votes: Vote[];
  profiles: Profile[];
  candidates: RestaurantFull[];
  activeProfile: Profile;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const myVote = votes.find((v) => v.profileId === activeProfile.id);
  const [pickId, setPickId] = useState<string | null>(myVote?.pickId ?? null);
  const [vetoId, setVetoId] = useState<string | null>(myVote?.vetoId ?? null);

  // family members vote from their own phones — keep this page fresh
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [router]);

  const voteByProfile = new Map(votes.map((v) => [v.profileId, v]));
  const submitted = !!myVote;
  const iDeferred = myVote?.deferred ?? false;
  const hasDouble = activeProfile.doubleCredits > 0;

  function submit() {
    startTransition(() => castVoteAction(session.id, pickId, vetoId, false));
  }

  function defer() {
    setPickId(null);
    setVetoId(null);
    startTransition(() => castVoteAction(session.id, null, null, true));
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="text-2xl font-bold">Family vote 🗳️</h1>
      <p className="text-sm text-muted">
        Tap your favorite, or 🚫 to veto one. Not fussed tonight? Defer to bank a 2× vote for next
        time.
      </p>

      {hasDouble && !iDeferred && (
        <p className="rounded-xl border border-accent bg-accent-soft/40 px-3 py-2 text-center text-sm font-semibold text-orange-200">
          🔥 Your vote counts 2× this round — you deferred last time.
        </p>
      )}
      {iDeferred && (
        <p className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-center text-sm font-semibold text-muted">
          ⏭️ You deferred — you&apos;re out this round, and you&apos;ll get a 2× vote next time.
        </p>
      )}

      <div className={`flex flex-col gap-3 ${iDeferred ? "pointer-events-none opacity-50" : ""}`}>
        {candidates.map((r) => {
          const isPick = pickId === r.id;
          const isVeto = vetoId === r.id;
          const days = daysSince(r.lastVisitAt);
          return (
            <div
              key={r.id}
              className={`flex items-center gap-3 rounded-2xl border-2 p-4 transition ${
                isPick
                  ? "border-accent bg-accent-soft/40"
                  : isVeto
                    ? "border-red-800 bg-red-950/40 opacity-70"
                    : "border-border-soft bg-surface"
              }`}
            >
              <button
                className="flex-1 text-left"
                disabled={iDeferred}
                onClick={() => {
                  setPickId(isPick ? null : r.id);
                  if (vetoId === r.id) setVetoId(null);
                }}
              >
                <p className="text-lg font-bold">
                  {isPick && "❤️ "}
                  {r.name}
                </p>
                <p className="text-sm text-muted">
                  {r.cuisines.join(" · ")} · {PRICE_LABELS[r.price - 1]}
                  {days !== null ? ` · ${days}d ago` : " · never been"}
                </p>
              </button>
              <a
                href={mapsLink(r)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-surface-2 px-2 py-1 text-sm"
              >
                🗺️
              </a>
              <button
                disabled={iDeferred}
                onClick={() => {
                  setVetoId(isVeto ? null : r.id);
                  if (pickId === r.id) setPickId(null);
                }}
                className={`rounded-lg px-2 py-1 text-xl ${isVeto ? "bg-red-900" : "bg-surface-2"}`}
                title="Veto"
              >
                🚫
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending || iDeferred || (!pickId && !vetoId)}
          className="flex-1 rounded-xl bg-accent px-4 py-3 text-lg font-bold text-black disabled:opacity-40"
        >
          {iDeferred
            ? "You deferred"
            : submitted
              ? "Update my vote"
              : `Vote as ${activeProfile.emoji} ${activeProfile.name}`}
        </button>
        <button
          onClick={defer}
          disabled={pending || iDeferred}
          className="rounded-xl border border-border-soft px-4 py-3 font-semibold text-muted disabled:opacity-40"
          title="Sit this one out and bank a 2× vote for next time"
        >
          ⏭️ Defer
        </button>
      </div>

      {/* who's voted */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>Voted:</span>
        {profiles.map((p) => {
          const v = voteByProfile.get(p.id);
          const label = !v ? "…" : v.deferred ? "⏭️" : "✓";
          return (
            <span
              key={p.id}
              className={`rounded-full border px-2 py-0.5 ${
                v ? "border-green-700 text-green-300" : "border-border-soft opacity-50"
              }`}
            >
              {p.emoji} {p.name} {label}
              {p.doubleCredits > 0 && " 🔥2×"}
            </span>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => startTransition(() => closeVoteAction(session.id))}
          disabled={pending || votes.length === 0}
          className="flex-1 rounded-xl border border-accent px-4 py-2 font-semibold text-accent disabled:opacity-40"
        >
          🏁 Close vote & reveal winner
        </button>
        <button
          onClick={() => startTransition(() => cancelVoteAction(session.id))}
          disabled={pending}
          className="rounded-xl border border-border-soft px-4 py-2 text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function VoteWinnerView({ winner }: { winner: RestaurantFull }) {
  const [pending, startTransition] = useTransition();
  const [logged, setLogged] = useState(false);
  return (
    <div className="pop-in flex flex-col items-center gap-4 rounded-2xl border-2 border-accent bg-surface p-6 text-center">
      <span className="text-5xl">🏆</span>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">The family has spoken</p>
        <h2 className="text-3xl font-extrabold">{winner.name}</h2>
        <p className="mt-1 text-muted">{winner.cuisines.join(" · ")}</p>
      </div>
      <div className="flex w-full gap-2">
        <a
          href={mapsLink(winner)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-xl bg-surface-2 px-4 py-3 font-semibold"
        >
          🗺️ Maps
        </a>
        {logged ? (
          <p className="flex-1 rounded-xl bg-green-950/60 px-4 py-3 font-semibold text-green-300">
            Logged 🎉
          </p>
        ) : (
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await logVisitAction(winner.id, "dine_in");
                setLogged(true);
              })
            }
            className="flex-1 rounded-xl bg-accent px-4 py-3 font-bold text-black disabled:opacity-50"
          >
            We went! 🎉
          </button>
        )}
      </div>
    </div>
  );
}
