import Link from "next/link";
import { deleteProfileAction, saveSettingsAction } from "@/app/actions";
import { passwordRequired } from "@/lib/auth";
import { db, isDemoMode } from "@/lib/data";
import { placesKey } from "@/lib/places";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, profiles] = await Promise.all([db().getSettings(), db().listProfiles()]);
  const inputCls =
    "rounded-xl border border-border-soft bg-surface-2 px-3 py-2.5 outline-none focus:border-accent";

  return (
    <div className="flex flex-col gap-5 pt-2">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-surface p-4">
        <h2 className="font-bold">Home location</h2>
        <p className="text-sm text-muted">
          Used by the discovery sweep and recommendations. Find your coordinates by long-pressing
          your home on Google Maps.
        </p>
        <form action={saveSettingsAction} className="flex flex-col gap-3">
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
                placeholder="37.7749"
                inputMode="decimal"
                className={inputCls}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold text-muted">Longitude</span>
              <input
                name="homeLng"
                defaultValue={settings.homeLng ?? ""}
                placeholder="-122.4194"
                inputMode="decimal"
                className={inputCls}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-muted">Search radius (miles)</span>
            <input
              name="radiusMiles"
              defaultValue={(settings.radiusMeters / 1609.34).toFixed(1)}
              inputMode="decimal"
              className={inputCls}
            />
          </label>
          <button className="rounded-xl bg-accent px-4 py-2.5 font-bold text-black">Save</button>
        </form>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-4">
        <h2 className="font-bold">Family</h2>
        <ul className="flex flex-col gap-2">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl"
                style={{ backgroundColor: `${p.color}33` }}
              >
                {p.emoji}
              </span>
              <span className="flex-1 font-semibold">{p.name}</span>
              {profiles.length > 1 && (
                <form action={deleteProfileAction.bind(null, p.id)}>
                  <button className="text-sm text-red-400" title="Remove (their ratings go too)">
                    Remove
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <Link href="/profiles" className="text-sm text-accent underline">
          Add someone / switch profile →
        </Link>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-4">
        <h2 className="font-bold">Data</h2>
        <Link href="/import" className="text-sm text-accent underline">
          Import from Google Takeout / export CSV →
        </Link>
      </section>

      <section className="rounded-2xl border border-border-soft bg-surface p-4 text-sm">
        <h2 className="mb-2 font-bold">System status</h2>
        <ul className="flex flex-col gap-1 text-muted">
          <li>{isDemoMode() ? "🟡 Demo mode — Supabase not connected" : "🟢 Database connected"}</li>
          <li>{passwordRequired() ? "🟢 Family password set" : "🟡 No family password (open access)"}</li>
          <li>
            {placesKey()
              ? "🟢 Google Places key set — discovery & recommendations on"
              : "🟡 No Google Places key — discovery & recommendations off"}
          </li>
        </ul>
      </section>
    </div>
  );
}
