import { notFound } from "next/navigation";
import {
  deleteRestaurantAction,
  logVisitAction,
  splitLocationAction,
  updateRestaurantAction,
} from "@/app/actions";
import { db } from "@/lib/data";
import { PRICE_LABELS, daysSince, mapsLink, openTableLink } from "@/lib/types";
import { distanceMiles, formatMiles } from "@/lib/distance";
import { RestaurantForm } from "@/components/RestaurantForm";
import { RatingRows } from "@/components/RatingRows";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { BackLink } from "@/components/BackLink";

export default async function RestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [restaurant, profiles, visits, settings] = await Promise.all([
    (await db()).getRestaurant(id),
    (await db()).listProfiles(),
    (await db()).listVisitsForRestaurant(id),
    (await db()).getSettings(),
  ]);
  if (!restaurant) notFound();

  const days = daysSince(restaurant.lastVisitAt);
  const home = { lat: settings.homeLat, lng: settings.homeLng };
  // sort the brand's branches nearest-first when we know where home is
  const locations = [...restaurant.locations]
    .map((loc) => ({ loc, dist: distanceMiles(home, loc) }))
    .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <BackLink fallback="/restaurants" className="text-sm text-muted">
          ← All places
        </BackLink>
        <h1 className="mt-1 text-2xl font-bold">{restaurant.name}</h1>
        <p className="text-muted">
          {restaurant.cuisines.join(" · ") || "uncategorized"} ·{" "}
          {PRICE_LABELS[restaurant.price - 1]}
          {restaurant.locationCount > 1 && ` · 📍 ${restaurant.locationCount} locations`}
          {days !== null && ` · last visit ${days}d ago`}
          {restaurant.status === "wishlist" && " · ⭐ wishlist"}
        </p>
      </div>

      <div className="flex gap-2">
        <a
          href={mapsLink(restaurant)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-xl bg-surface-2 px-4 py-3 text-center font-semibold"
        >
          🗺️ Maps
        </a>
        <a
          href={openTableLink(restaurant)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-xl bg-surface-2 px-4 py-3 text-center font-semibold"
        >
          🪑 Reserve
        </a>
      </div>

      <section className="rounded-2xl border border-border-soft bg-surface p-4">
        <h2 className="mb-3 font-bold">Family ratings</h2>
        <RatingRows restaurantId={restaurant.id} profiles={profiles} ratings={restaurant.ratings} />
      </section>

      <section className="rounded-2xl border border-border-soft bg-surface p-4">
        <h2 className="mb-3 font-bold">
          {restaurant.locationCount > 1 ? `Locations (${restaurant.locationCount})` : "Location"}
        </h2>
        <ul className="flex flex-col gap-2">
          {locations.map(({ loc, dist }) => (
            <li key={loc.id} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {loc.address?.split(",")[0]?.trim() || loc.name}
                </p>
                <p className="truncate text-xs text-muted">
                  {loc.address || "no address"}
                  {dist !== null && ` · ${formatMiles(dist)}`}
                </p>
              </div>
              <a
                href={mapsLink(loc)}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg bg-surface px-3 py-2 text-sm font-semibold"
              >
                🗺️ Maps
              </a>
              {restaurant.locationCount > 1 && (
                <form
                  action={async () => {
                    "use server";
                    await splitLocationAction(restaurant.id, loc.id);
                  }}
                >
                  <button
                    className="shrink-0 rounded-lg border border-border-soft px-3 py-2 text-sm text-muted"
                    title="Make this its own separate entry"
                  >
                    Split out
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border-soft bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">
            Visits <span className="font-normal text-muted">({visits.length})</span>
          </h2>
          <form
            action={async () => {
              "use server";
              await logVisitAction(restaurant.id, "dine_in");
            }}
          >
            <button className="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold">
              +1 visit today
            </button>
          </form>
        </div>
        <ul className="flex flex-col gap-1 text-sm text-muted">
          {visits.slice(0, 10).map((v) => (
            <li key={v.id}>
              {new Date(v.date).toLocaleDateString()} · {v.mode === "takeout" ? "🥡 takeout" : "🍽️ dine in"}
              {v.note && ` · ${v.note}`}
            </li>
          ))}
          {visits.length === 0 && <li>No visits logged yet.</li>}
        </ul>
      </section>

      <details className="rounded-2xl border border-border-soft bg-surface p-4">
        <summary className="cursor-pointer font-bold">Edit details</summary>
        <div className="mt-4">
          <RestaurantForm
            action={updateRestaurantAction.bind(null, restaurant.id)}
            initial={restaurant}
            submitLabel="Save changes"
          />
          <ConfirmDelete action={deleteRestaurantAction.bind(null, restaurant.id)} />
        </div>
      </details>
    </div>
  );
}
