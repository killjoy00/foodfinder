import { db } from "@/lib/data";
import { placesKey } from "@/lib/places";
import { DiscoverClient } from "@/components/DiscoverClient";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const [discoveries, settings] = await Promise.all([(await db()).listDiscoveries(), (await db()).getSettings()]);
  return (
    <DiscoverClient
      discoveries={discoveries}
      hasKey={!!placesKey()}
      hasHome={settings.homeLat !== null && settings.homeLng !== null}
      defaultRadiusMiles={Math.round(settings.radiusMeters / 1609.34)}
    />
  );
}
