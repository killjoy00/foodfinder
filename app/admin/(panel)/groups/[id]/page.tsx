import Link from "next/link";
import { notFound } from "next/navigation";
import { registry } from "@/lib/data";
import { GroupAdminClient } from "@/components/admin/GroupAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = (await registry().listHouseholdSummaries()).find((g) => g.id === id);
  if (!group) notFound();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/admin" className="text-sm text-muted">
          ← Groups
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{group.name}</h1>
        <p className="text-sm text-muted">
          {group.profileCount} member{group.profileCount === 1 ? "" : "s"}
          {group.profileNames.length > 0 && ` (${group.profileNames.join(", ")})`} ·{" "}
          {group.trackedCount} tracked · {group.visitCount} visit{group.visitCount === 1 ? "" : "s"}
        </p>
      </div>
      <GroupAdminClient id={group.id} name={group.name} />
    </div>
  );
}
