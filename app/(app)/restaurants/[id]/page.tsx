import { notFound } from "next/navigation";
import {
  deleteRestaurantAction,
  logVisitAction,
  updateRestaurantAction,
} from "@/app/actions";
import { db } from "@/lib/data";
import { PRICE_LABELS, daysSince, mapsLink, openTableLink } from "@/lib/types";
import { RestaurantForm } from "@/components/RestaurantForm";
import { RatingRows } from "@/components/RatingRows";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { BackLink } from "@/components/BackLink";

export default async function RestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [restaurant, profiles, visits] = await Promise.all([
    (await db()).getRestaurant(id),
    (await db()).listProfiles(),
    (await db()).listVisitsForRestaurant(id),
  ]);
  if (!restaurant) notFound();

  const days = daysSince(restaurant.lastVisitAt);

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
