import Link from "next/link";
import { deleteProfileAction, logoutAction, updateProfileAction } from "@/app/actions";
import { LocationForm } from "@/components/LocationForm";
import { ProfileEditor } from "@/components/ProfileEditor";
import { getActiveHousehold } from "@/lib/auth";
import { db, isDemoMode } from "@/lib/data";
import { placesKey } from "@/lib/places";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, profiles, household] = await Promise.all([
    (await db()).getSettings(),
    (await db()).listProfiles(),
    getActiveHousehold(),
  ]);

  return (
    <div className="flex flex-col gap-5 pt-2">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-surface p-4">
        <h2 className="font-bold">Home location</h2>
        <p className="text-sm text-muted">
          Used by the discovery sweep and recommendations — just a ZIP code is fine.
        </p>
        <LocationForm settings={settings} />
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-4">
        <h2 className="font-bold">Family</h2>
        <ul className="flex flex-col gap-1">
          {profiles.map((p) => (
            <li key={p.id}>
              <details className="group rounded-xl">
                <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full text-xl ring-2 ring-white/25"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.emoji}
                  </span>
                  <span className="flex-1 font-semibold">{p.name}</span>
                  <span className="text-sm text-muted group-open:hidden">Edit</span>
                  <span className="hidden text-sm text-muted group-open:inline">Close</span>
                </summary>
                <div className="mt-2 flex flex-col gap-3 rounded-xl border border-border-soft bg-surface-2/50 p-3">
                  <ProfileEditor
                    action={updateProfileAction.bind(null, p.id)}
                    initial={p}
                    submitLabel="Save changes"
                  />
                  {profiles.length > 1 && (
                    <form action={deleteProfileAction.bind(null, p.id)}>
                      <button
                        className="w-full rounded-xl border border-red-900 px-4 py-2 text-sm font-semibold text-red-400"
                        title="Remove (their ratings go too)"
                      >
                        Remove {p.name} (their ratings go too)
                      </button>
                    </form>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
        <Link href="/profiles" className="text-sm text-accent underline">
          Add someone / switch profile →
        </Link>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-4">
        <h2 className="font-bold">Data</h2>
        <Link href="/insights" className="text-sm text-accent underline">
          📊 Your food story (insights) →
        </Link>
        <Link href="/restaurants/duplicates" className="text-sm text-accent underline">
          🔁 Find &amp; merge duplicates →
        </Link>
        <Link href="/import" className="text-sm text-accent underline">
          Import from Google Takeout / export CSV →
        </Link>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-surface p-4">
        <h2 className="font-bold">Group</h2>
        <p className="text-sm text-muted">
          You&apos;re in <strong className="text-foreground">{household?.name ?? "—"}</strong>. Share
          the group name and password to let other family in; they each pick their own profile.
        </p>
        <form action={logoutAction}>
          <button className="w-full rounded-xl border border-border-soft px-4 py-2 text-sm font-semibold">
            Log out / switch group
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-border-soft bg-surface p-4 text-sm">
        <h2 className="mb-2 font-bold">System status</h2>
        <ul className="flex flex-col gap-1 text-muted">
          <li>{isDemoMode() ? "🟡 Demo mode — Supabase not connected" : "🟢 Database connected"}</li>
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
