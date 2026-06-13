import { db } from "@/lib/data";
import { RestaurantList } from "@/components/RestaurantList";

export default async function RestaurantsPage() {
  const [restaurants, settings] = await Promise.all([db().listRestaurants(), db().getSettings()]);
  return (
    <RestaurantList
      restaurants={restaurants}
      home={{ lat: settings.homeLat, lng: settings.homeLng }}
    />
  );
}
