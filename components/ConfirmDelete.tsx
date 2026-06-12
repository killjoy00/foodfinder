"use client";

import { useState, useTransition } from "react";

export function ConfirmDelete({ action }: { action: () => Promise<void> }) {
  const [arming, setArming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!arming) {
    return (
      <button
        type="button"
        onClick={() => setArming(true)}
        className="mt-4 w-full rounded-xl border border-red-900 px-4 py-2 text-sm font-semibold text-red-400"
      >
        Delete this restaurant
      </button>
    );
  }
  return (
    <div className="mt-4 flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => action())}
        className="flex-1 rounded-xl bg-red-900 px-4 py-2 text-sm font-bold text-red-100 disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Yes, delete it (ratings & visits too)"}
      </button>
      <button
        type="button"
        onClick={() => setArming(false)}
        className="rounded-xl border border-border-soft px-4 py-2 text-sm text-muted"
      >
        Keep it
      </button>
    </div>
  );
}
