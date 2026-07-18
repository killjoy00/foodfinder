import { db } from "@/lib/data";
import { getActiveHousehold } from "@/lib/auth";
import { StartClient } from "@/components/StartClient";

export const dynamic = "force-dynamic";

export default async function StartPage() {
  const [catalog, restaurants, household] = await Promise.all([
    (await db()).listCatalog(),
    (await db()).listRestaurants(),
    getActiveHousehold(),
  ]);
  return (
    <StartClient
      groupName={household?.name ?? "your family"}
      trackedCount={restaurants.length}
      catalog={catalog.map((c) => ({ id: c.id, cuisines: c.cuisines, tracked: c.tracked }))}
    />
  );
}
