import { redirect } from "next/navigation";
import { addProfileAction, selectProfileAction } from "@/app/actions";
import { isAuthed } from "@/lib/auth";
import { db } from "@/lib/data";
import { ProfileEditor } from "@/components/ProfileEditor";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  if (!(await isAuthed())) redirect("/login");
  const profiles = await (await db()).listProfiles();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 p-6">
      <h1 className="text-2xl font-bold">Who&apos;s picking tonight?</h1>

      <div className="grid w-full grid-cols-2 gap-4">
        {profiles.map((p) => (
          <form key={p.id} action={selectProfileAction.bind(null, p.id)}>
            <button
              type="submit"
              className="flex w-full flex-col items-center gap-2 rounded-2xl border border-border-soft bg-surface p-6 transition hover:border-accent"
            >
              <span
                className="flex h-20 w-20 items-center justify-center rounded-full text-5xl ring-2 ring-white/25"
                style={{ backgroundColor: p.color }}
              >
                {p.emoji}
              </span>
              <span
                className="rounded-full px-3 py-0.5 font-semibold"
                style={{ backgroundColor: `${p.color}33`, color: p.color }}
              >
                {p.name}
              </span>
            </button>
          </form>
        ))}
      </div>

      <details className="w-full rounded-2xl border border-border-soft bg-surface p-4">
        <summary className="cursor-pointer font-semibold text-muted">Add a family member</summary>
        <div className="mt-4">
          <ProfileEditor action={addProfileAction} submitLabel="Add to the family" />
        </div>
      </details>

      <p className="text-center text-xs text-muted">
        Need to change a face or color? Edit family members in Settings → Family.
      </p>
    </main>
  );
}
