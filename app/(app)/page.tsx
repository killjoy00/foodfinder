import { db } from "@/lib/data";
import { buildCuisineRecency } from "@/lib/picker";
import { TonightPicker } from "@/components/TonightPicker";

export default async function TonightPage() {
  const [restaurants, profiles, recentVisits, settings] = await Promise.all([
    (await db()).listRestaurants(),
    (await db()).listProfiles(),
    (await db()).listRecentVisits(50),
    (await db()).getSettings(),
  ]);

  const cuisinesByRestaurant = new Map(restaurants.map((r) => [r.id, r.cuisines]));
  const cuisineRecency = buildCuisineRecency(recentVisits, cuisinesByRestaurant);
  const allCuisines = [...new Set(restaurants.flatMap((r) => r.cuisines))].sort();

  return (
    <TonightPicker
      restaurants={restaurants}
      profiles={profiles}
      cuisineRecency={cuisineRecency}
      allCuisines={allCuisines}
      home={{ lat: settings.homeLat, lng: settings.homeLng }}
    />
  );
}
