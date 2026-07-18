import { redirect } from "next/navigation";
import { isAdminAuthed, isAdminConfigured } from "@/lib/admin";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdminAuthed()) redirect("/admin");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-bold">🔧 FoodFinder admin</h1>
        <p className="mt-1 text-sm text-muted">
          Owner access — manage groups and the master catalog.
        </p>
      </div>
      {isAdminConfigured() ? (
        <AdminLoginForm />
      ) : (
        <p className="rounded-2xl border border-yellow-700 bg-yellow-950/50 px-4 py-3 text-sm text-yellow-200">
          Admin isn&apos;t set up yet. Add an <code>ADMIN_SECRET</code> environment variable in
          Vercel (any long random string) and redeploy, then log in here with it.
        </p>
      )}
    </main>
  );
}
