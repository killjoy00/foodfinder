"use client";

import { useState, useTransition } from "react";
import { startNominationRoundAction, startQuickVoteAction } from "@/app/actions";
import { DEFAULT_VOTE_SIZE, VOTE_SIZE_CHOICES } from "@/lib/picker";

export function QuickVoteStart({ available }: { available: number }) {
  const [count, setCount] = useState(Math.min(DEFAULT_VOTE_SIZE, available));
  const [pending, startTransition] = useTransition();
  const sizes = VOTE_SIZE_CHOICES.filter((n) => n <= available);

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      {available >= 2 ? (
        <>
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm font-semibold text-muted">Options:</span>
            {sizes.map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`h-10 w-10 rounded-xl border font-bold ${
                  count === n
                    ? "border-accent bg-accent-soft text-orange-200"
                    : "border-border-soft text-muted"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={() => startTransition(() => startQuickVoteAction(count))}
            disabled={pending}
            className="rounded-xl bg-accent px-5 py-3 font-bold text-black disabled:opacity-50"
          >
            {pending ? "Drawing options…" : `🗳️ Start a ${count}-way vote`}
          </button>
          <p className="text-center text-xs text-muted">
            Options are drawn with the same smarts as the wheel — favorites, long-missed places, and
            a dash of wishlist. For filtered candidates, start the vote from the Tonight tab instead.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">
          Add at least two restaurants and a quick-draw family vote becomes possible.
        </p>
      )}
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border-soft" />
        or
        <span className="h-px flex-1 bg-border-soft" />
      </div>
      <button
        onClick={() => startTransition(() => startNominationRoundAction())}
        disabled={pending}
        className="rounded-xl border border-accent px-5 py-3 font-semibold text-accent disabled:opacity-50"
      >
        🙋 Everyone nominates
      </button>
      <p className="text-center text-xs text-muted">
        Each person puts up to two places on the ballot — from your list or somewhere new — then the
        family votes, or the wheel decides.
      </p>
    </div>
  );
}
