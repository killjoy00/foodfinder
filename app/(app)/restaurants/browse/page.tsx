import Link from "next/link";
import { db } from "@/lib/data";
import { BrowseClient } from "@/components/BrowseClient";

export const dynamic = "force-dynamic";

export default async function BrowsePage() {
  const [catalog, settings] = await Promise.all([
    (await db()).listCatalog(),
    (await db()).getSettings(),
  ]);
  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <Link href="/restaurants" className="text-sm text-muted">
          ← Our places
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Browse the master list 🔎</h1>
        <p className="text-sm text-muted">
          Every restaurant in the shared catalog. Add the ones your family cares about to your
          wishlist or mark them visited.
        </p>
      </div>
      <BrowseClient catalog={catalog} home={{ lat: settings.homeLat, lng: settings.homeLng }} />
    </div>
  );
}
