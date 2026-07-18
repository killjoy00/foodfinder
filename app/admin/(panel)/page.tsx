import Link from "next/link";
import { registry } from "@/lib/data";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function AdminGroupsPage() {
  const groups = await registry().listHouseholdSummaries();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Groups</h1>
        <p className="text-sm text-muted">
          Every family that has signed up — {groups.length} total.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {groups.map((g) => (
          <li key={g.id}>
            <Link
              href={`/admin/groups/${g.id}`}
              className="flex flex-col gap-1 rounded-2xl border border-border-soft bg-surface p-4 hover:border-accent"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-bold">{g.name}</span>
                <span className="shrink-0 text-xs text-muted">joined {fmtDate(g.createdAt)}</span>
              </div>
              <p className="text-sm text-muted">
                {g.profileCount} member{g.profileCount === 1 ? "" : "s"}
                {g.profileNames.length > 0 && ` (${g.profileNames.join(", ")})`} ·{" "}
                {g.trackedCount} tracked · {g.visitCount} visit{g.visitCount === 1 ? "" : "s"}
                {g.lastVisitAt && ` · last visit ${fmtDate(g.lastVisitAt)}`}
              </p>
            </Link>
          </li>
        ))}
        {groups.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border-soft p-8 text-center text-muted">
            No groups yet.
          </li>
        )}
      </ul>
    </div>
  );
}
