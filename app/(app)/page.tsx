import { db } from "@/lib/data";
import { TonightPicker } from "@/components/TonightPicker";

export default async function TonightPage() {
  const [restaurants, profiles, recentVisits, settings] = await Promise.all([
    db().listRestaurants(),
    db().listProfiles(),
    db().listRecentVisits(3),
    db().getSettings(),
  ]);

  const byId = new Map(restaurants.map((r) => [r.id, r]));
  const recentVisitCuisines = recentVisits.map((v) => byId.get(v.restaurantId)?.cuisines ?? []);
  const allCuisines = [...new Set(restaurants.flatMap((r) => r.cuisines))].sort();

  return (
    <TonightPicker
      restaurants={restaurants}
      profiles={profiles}
      recentVisitCuisines={recentVisitCuisines}
      allCuisines={allCuisines}
      home={{ lat: settings.homeLat, lng: settings.homeLng }}
    />
  );
}
