"use client";

import { useMemo, useState, useTransition } from "react";
import {
  adminDeleteCatalogRowAction,
  adminImportCatalogAction,
  adminUpdateCatalogRowAction,
} from "@/app/admin/actions";
import { AdminCatalogRow } from "@/lib/data/adapter";
import { parseCatalogCsv } from "@/lib/catalog";
import { PRICE_LABELS } from "@/lib/types";

const PAGE = 50;

export function AdminCatalogClient({ rows }: { rows: AdminCatalogRow[] }) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Record<string, AdminCatalogRow>>({});
  const [pending, startTransition] = useTransition();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => !deleted.has(r.id))
      .map((r) => saved[r.id] ?? r)
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.cuisines.some((c) => c.toLowerCase().includes(q)) ||
          (r.address ?? "").toLowerCase().includes(q)
      );
  }, [rows, query, deleted, saved]);

  function save(row: AdminCatalogRow, formData: FormData) {
    const patch = {
      name: String(formData.get("name") ?? row.name).trim() || row.name,
      cuisines: String(formData.get("cuisines") ?? "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      price: Number(formData.get("price") ?? row.price) || row.price,
      address: String(formData.get("address") ?? "").trim() || null,
      mapsUrl: String(formData.get("mapsUrl") ?? "").trim() || null,
    };
    startTransition(async () => {
      await adminUpdateCatalogRowAction(row.id, patch);
      setSaved((prev) => ({ ...prev, [row.id]: { ...row, ...patch } }));
      setEditing(null);
    });
  }

  function remove(row: AdminCatalogRow) {
    const warn =
      row.trackedBy > 0
        ? `${row.name} is on ${row.trackedBy} family list${row.trackedBy === 1 ? "" : "s"} — deleting removes it from them too. Delete?`
        : `Delete ${row.name} from the catalog?`;
    if (!window.confirm(warn)) return;
    startTransition(async () => {
      await adminDeleteCatalogRowAction(row.id);
      setDeleted((prev) => new Set(prev).add(row.id));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <CsvImport />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setLimit(PAGE);
        }}
        placeholder="Search name, cuisine, or address…"
        className="rounded-xl border border-border-soft bg-surface px-4 py-2.5 outline-none focus:border-accent"
      />
      <p className="text-xs text-muted">
        {shown.length === 0 ? "0 matches" : `Showing ${Math.min(limit, shown.length)} of ${shown.length}`}
      </p>
      <ul className="flex flex-col gap-2">
        {shown.slice(0, limit).map((r) =>
          editing === r.id ? (
            <li key={r.id} className="rounded-2xl border border-accent bg-surface p-3">
              <form action={(fd) => save(r, fd)} className="flex flex-col gap-2">
                <input
                  name="name"
                  defaultValue={r.name}
                  placeholder="Name"
                  className="rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <input
                  name="cuisines"
                  defaultValue={r.cuisines.join(", ")}
                  placeholder="Cuisines (comma-separated)"
                  className="rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <div className="flex gap-2">
                  <select
                    name="price"
                    defaultValue={r.price}
                    className="rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-sm outline-none"
                  >
                    {PRICE_LABELS.map((label, i) => (
                      <option key={label} value={i + 1}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    name="address"
                    defaultValue={r.address ?? ""}
                    placeholder="Address"
                    className="min-w-0 flex-1 rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </div>
                <input
                  name="mapsUrl"
                  defaultValue={r.mapsUrl ?? ""}
                  placeholder="Google Maps link"
                  className="rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <div className="flex gap-2">
                  <button
                    disabled={pending}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
                  >
                    {pending ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="rounded-lg bg-surface-2 px-4 py-2 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </li>
          ) : (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{r.name}</p>
                <p className="truncate text-sm text-muted">
                  {r.cuisines.join(" · ") || "uncategorized"} · {PRICE_LABELS[r.price - 1]}
                  {r.address ? ` · ${r.address}` : ""}
                </p>
                <p className="text-xs text-muted">
                  {r.trackedBy === 0
                    ? "on no family lists"
                    : `on ${r.trackedBy} family list${r.trackedBy === 1 ? "" : "s"}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => setEditing(r.id)}
                  className="rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold"
                >
                  Edit
                </button>
                <button
                  disabled={pending}
                  onClick={() => remove(r)}
                  className="rounded-lg border border-red-800 px-3 py-2 text-sm font-semibold text-red-300"
                >
                  Delete
                </button>
              </div>
            </li>
          )
        )}
        {shown.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border-soft p-8 text-center text-muted">
            Nothing matches.
          </li>
        )}
      </ul>
      {limit < shown.length && (
        <button
          onClick={() => setLimit((n) => n + PAGE)}
          className="self-center rounded-xl border border-border-soft bg-surface-2 px-4 py-2.5 text-sm font-semibold"
        >
          Show more ({shown.length - limit} more)
        </button>
      )}
    </div>
  );
}

function CsvImport() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<number | null>(null);
  const [rows, setRows] = useState<ReturnType<typeof parseCatalogCsv> | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFile(file: File) {
    setError(null);
    setAdded(null);
    try {
      const parsed = parseCatalogCsv(await file.text());
      if (parsed.length === 0) {
        setError("No rows found in that CSV.");
        return;
      }
      setRows(parsed);
      setCount(parsed.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    }
  }

  return (
    <details className="rounded-2xl border border-border-soft bg-surface p-4">
      <summary className="cursor-pointer font-bold">Bulk import (CSV)</summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-sm text-muted">
          Add a city list to the catalog. Recognizes columns like Name, Cuisine, Price,
          Neighborhood/Address, and a Google Maps link or place id. Duplicates are skipped.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          className="rounded-xl border border-border-soft bg-surface-2 p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:font-semibold file:text-black"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        {rows && (
          <button
            onClick={() =>
              startTransition(async () => {
                setAdded(await adminImportCatalogAction(rows));
                setRows(null);
              })
            }
            disabled={pending}
            className="rounded-xl bg-accent px-4 py-3 font-bold text-black disabled:opacity-50"
          >
            {pending ? "Adding…" : `Add ${count} to the catalog`}
          </button>
        )}
        {added !== null && (
          <p className="rounded-xl bg-green-950/60 px-4 py-3 text-sm font-semibold text-green-300">
            Added {added} new restaurant{added === 1 ? "" : "s"} (refresh to see them listed). 🎉
          </p>
        )}
      </div>
    </details>
  );
}
