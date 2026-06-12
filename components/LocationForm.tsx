"use client";

import { useActionState } from "react";
import { saveLocationAction } from "@/app/actions";
import { Settings } from "@/lib/types";

export function LocationForm({ settings }: { settings: Settings }) {
  const [state, formAction, pending] = useActionState(saveLocationAction, null);
  const inputCls =
    "rounded-xl border border-border-soft bg-surface-2 px-3 py-2.5 outline-none focus:border-accent";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {settings.homeLat !== null && (
        <p className="text-sm text-muted">
          Current home: <strong className="text-foreground">{settings.homeLabel ?? "set"}</strong>
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-muted">ZIP code</span>
        <input
          name="zip"
          placeholder="e.g. 94110"
          inputMode="numeric"
          autoComplete="postal-code"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-muted">Search radius (miles)</span>
        <input
          name="radiusMiles"
          defaultValue={(settings.radiusMeters / 1609.34).toFixed(1)}
          inputMode="decimal"
          className={inputCls}
        />
      </label>

      <details>
        <summary className="cursor-pointer text-sm text-muted">
          Advanced: exact coordinates instead
        </summary>
        <div className="mt-2 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-muted">Label</span>
            <input
              name="homeLabel"
              defaultValue={settings.homeLabel ?? ""}
              placeholder="Home"
              className={inputCls}
            />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-muted">Latitude</span>
              <input
                name="homeLat"
                defaultValue={settings.homeLat ?? ""}
                inputMode="decimal"
                className={inputCls}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-muted">Longitude</span>
              <input
                name="homeLng"
                defaultValue={settings.homeLng ?? ""}
                inputMode="decimal"
                className={inputCls}
              />
            </label>
          </div>
        </div>
      </details>

      <button
        disabled={pending}
        className="rounded-xl bg-accent px-4 py-2.5 font-bold text-black disabled:opacity-50"
      >
        {pending ? "Looking up…" : "Save location"}
      </button>
      {state && (
        <p
          className={`rounded-xl px-3 py-2 text-center text-sm font-semibold ${
            state.ok ? "bg-green-950/60 text-green-300" : "bg-red-950/60 text-red-300"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
