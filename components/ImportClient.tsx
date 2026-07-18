"use client";

import { useState, useTransition } from "react";
import { importTakeoutAction } from "@/app/actions";
import { TakeoutItem, parseTakeoutAny } from "@/lib/takeout";

export function ImportClient() {
  const [items, setItems] = useState<TakeoutItem[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFile(file: File) {
    setError(null);
    setResult(null);
    try {
      const parsed = parseTakeoutAny(await file.text(), file.name);
      if (parsed.length === 0) {
        setError("No places found in that file.");
        return;
      }
      setItems(parsed);
      setSelected(new Set(parsed.map((_, i) => i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    }
  }

  function runImport() {
    if (!items) return;
    const chosen = items.filter((_, i) => selected.has(i));
    startTransition(async () => {
      const r = await importTakeoutAction(chosen);
      setResult(r);
      setItems(null);
    });
  }

  return (
    <div className="flex flex-col gap-5 pt-2">
      <h1 className="text-2xl font-bold">Import & export</h1>

      <section className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-surface p-4">
        <h2 className="font-bold">Seed from Google Takeout</h2>
        <ol className="list-inside list-decimal text-sm text-muted">
          <li>
            Go to{" "}
            <a
              href="https://takeout.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline"
            >
              takeout.google.com
            </a>{" "}
            and click <strong>Deselect all</strong>.
          </li>
          <li>
            Tick <strong>“Maps (your places)”</strong> (it&apos;s in the alphabetical list under M,
            just after “Maps” — use your browser&apos;s find-on-page if needed). For your saved
            lists, also tick <strong>“Saved”</strong> (under S).
          </li>
          <li>Next step → Export once → Create export, then unzip the download.</li>
          <li>
            Upload here: <strong>Reviews.json</strong> (your rated places → “Been there” with
            ratings), <strong>Saved Places.json</strong> (→ wishlist), and/or any list CSV from the
            Saved folder like <strong>Favorites.csv</strong> or <strong>Want to go.csv</strong> (→
            wishlist).
          </li>
        </ol>
        <input
          type="file"
          accept=".json,.csv,application/json,text/csv"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          className="rounded-xl border border-border-soft bg-surface-2 p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:font-semibold file:text-black"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        {result && (
          <p className="rounded-xl bg-green-950/60 px-4 py-3 text-sm font-semibold text-green-300">
            Imported {result.imported} place{result.imported === 1 ? "" : "s"}
            {result.skipped > 0 && ` (${result.skipped} skipped as duplicates)`}. 🎉
          </p>
        )}
      </section>

      {items && (
        <section className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-surface p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">
              Found {items.length} — import {selected.size}
            </h2>
            <button
              onClick={() =>
                setSelected(
                  selected.size === items.length ? new Set() : new Set(items.map((_, i) => i))
                )
              }
              className="text-sm text-accent underline"
            >
              {selected.size === items.length ? "Select none" : "Select all"}
            </button>
          </div>
          <p className="text-xs text-muted">
            Untick anything that isn&apos;t a restaurant (Takeout includes every saved place).
          </p>
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {items.map((item, i) => (
              <li key={i}>
                <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => {
                      const next = new Set(selected);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      setSelected(next);
                    }}
                    className="h-4 w-4 accent-orange-500"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    <strong>{item.name}</strong>
                    {item.address && <span className="text-muted"> · {item.address}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {item.kind === "review" ? `★ ${item.starRating}` : "saved"}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            onClick={runImport}
            disabled={pending || selected.size === 0}
            className="rounded-xl bg-accent px-4 py-3 font-bold text-black disabled:opacity-40"
          >
            {pending ? "Importing…" : `Import ${selected.size} place${selected.size === 1 ? "" : "s"}`}
          </button>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-surface p-4">
        <h2 className="font-bold">Export your data</h2>
        <p className="text-sm text-muted">
          Your history is yours — download it anytime as CSV (opens in any spreadsheet).
        </p>
        <div className="flex gap-2">
          <a
            href="/api/export/restaurants"
            className="flex-1 rounded-xl bg-surface-2 px-4 py-3 text-center font-semibold"
          >
            📋 Restaurants & ratings
          </a>
          <a
            href="/api/export/visits"
            className="flex-1 rounded-xl bg-surface-2 px-4 py-3 text-center font-semibold"
          >
            🗓️ Visit history
          </a>
        </div>
      </section>

    </div>
  );
}
