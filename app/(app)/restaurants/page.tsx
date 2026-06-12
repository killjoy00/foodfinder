import { db } from "@/lib/data";
import { RestaurantList } from "@/components/RestaurantList";

export default async function RestaurantsPage() {
  const restaurants = await db().listRestaurants();
  return <RestaurantList restaurants={restaurants} />;
}
