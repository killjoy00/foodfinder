import { registry } from "@/lib/data";
import { AdminCatalogClient } from "@/components/admin/AdminCatalogClient";

export const dynamic = "force-dynamic";

export default async function AdminCatalogPage() {
  const rows = await registry().listCatalogAdmin();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Master catalog</h1>
        <p className="text-sm text-muted">
          The shared restaurant list every family browses — {rows.length} locations. Edits here
          show up for everyone.
        </p>
      </div>
      <AdminCatalogClient rows={rows} />
    </div>
  );
}
