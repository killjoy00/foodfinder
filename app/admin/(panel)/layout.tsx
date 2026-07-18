import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { isDemoMode } from "@/lib/data";
import { adminLogoutAction } from "@/app/admin/actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 pb-12">
      <header className="flex items-center justify-between gap-3 py-4">
        <Link href="/admin" className="text-lg font-bold tracking-tight">
          🔧 Admin
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/admin" className="text-muted hover:text-foreground">
            Groups
          </Link>
          <Link href="/admin/catalog" className="text-muted hover:text-foreground">
            Catalog
          </Link>
          <Link href="/" className="text-muted hover:text-foreground">
            App →
          </Link>
          <form action={adminLogoutAction}>
            <button className="rounded-lg border border-border-soft bg-surface-2 px-3 py-1.5 font-semibold">
              Log out
            </button>
          </form>
        </nav>
      </header>
      {isDemoMode() && (
        <p className="mb-3 rounded-xl border border-yellow-700 bg-yellow-950/50 px-3 py-2 text-xs text-yellow-200">
          Demo mode — admin is open without a secret and changes aren&apos;t saved permanently.
        </p>
      )}
      {children}
    </div>
  );
}
