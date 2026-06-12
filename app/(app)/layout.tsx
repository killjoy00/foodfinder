import Link from "next/link";
import { requireProfile, passwordRequired } from "@/lib/auth";
import { isDemoMode } from "@/lib/data";
import { switchProfileAction } from "@/app/actions";
import { NavTabs } from "@/components/NavTabs";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const demo = isDemoMode();

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="flex items-center justify-between px-4 pb-2 pt-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="text-2xl">🍽️</span> FoodFinder
        </Link>
        <form action={switchProfileAction}>
          <button
            type="submit"
            title="Switch profile"
            className="flex items-center gap-2 rounded-full border border-border-soft bg-surface py-1 pl-1 pr-3 text-sm"
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-lg"
              style={{ backgroundColor: `${profile.color}33` }}
            >
              {profile.emoji}
            </span>
            {profile.name}
          </button>
        </form>
      </header>

      {demo && (
        <p className="mx-4 mb-2 rounded-xl border border-yellow-700 bg-yellow-950/50 px-3 py-2 text-xs text-yellow-200">
          Demo mode — sample data, nothing is saved permanently. Connect Supabase (see DEPLOY.md){" "}
          {passwordRequired() ? "" : "and set FAMILY_PASSWORD "}to go live.
        </p>
      )}

      <main className="flex-1 px-4 pb-24">{children}</main>

      <NavTabs />
    </div>
  );
}
