import { redirect } from "next/navigation";
import { addProfileAction, selectProfileAction } from "@/app/actions";
import { isAuthed } from "@/lib/auth";
import { db } from "@/lib/data";

const PROFILE_COLORS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ec4899", "#eab308"];

export default async function ProfilesPage() {
  if (!(await isAuthed())) redirect("/login");
  const profiles = await db().listProfiles();

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
                className="flex h-16 w-16 items-center justify-center rounded-full text-4xl"
                style={{ backgroundColor: `${p.color}33` }}
              >
                {p.emoji}
              </span>
              <span className="font-semibold">{p.name}</span>
            </button>
          </form>
        ))}
      </div>

      <details className="w-full rounded-2xl border border-border-soft bg-surface p-4">
        <summary className="cursor-pointer font-semibold text-muted">Add a family member</summary>
        <form action={addProfileAction} className="mt-4 flex flex-col gap-3">
          <input
            name="name"
            placeholder="Name"
            required
            className="rounded-xl border border-border-soft bg-surface-2 px-3 py-2 outline-none focus:border-accent"
          />
          <div className="flex gap-3">
            <input
              name="emoji"
              placeholder="🙂"
              maxLength={4}
              className="w-20 rounded-xl border border-border-soft bg-surface-2 px-3 py-2 text-center outline-none focus:border-accent"
            />
            <select
              name="color"
              className="flex-1 rounded-xl border border-border-soft bg-surface-2 px-3 py-2 outline-none focus:border-accent"
            >
              {PROFILE_COLORS.map((c, i) => (
                <option key={c} value={c}>
                  {["Orange", "Blue", "Green", "Purple", "Pink", "Yellow"][i]}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded-xl bg-accent px-4 py-2 font-semibold text-black">
            Add
          </button>
        </form>
      </details>
    </main>
  );
}
