import Link from "next/link";
import { db } from "@/lib/data";
import { computeInsights } from "@/lib/insights";
import { PRICE_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col rounded-2xl border border-border-soft bg-surface p-3">
      <span className="text-2xl font-extrabold">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 shrink-0 truncate">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
        />
      </div>
      <span className="w-8 text-right text-muted">{value}</span>
    </div>
  );
}

export default async function InsightsPage() {
  const [restaurants, visits, profiles] = await Promise.all([
    (await db()).listRestaurants(),
    (await db()).listRecentVisits(100000),
    (await db()).listProfiles(),
  ]);
  const i = computeInsights(restaurants, visits, profiles);
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  if (restaurants.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 pt-16 text-center">
        <span className="text-5xl">📊</span>
        <h1 className="text-2xl font-bold">Nothing to chart yet</h1>
        <p className="max-w-sm text-muted">Add a few places and log some visits — your family food story builds itself.</p>
        <Link href="/restaurants" className="rounded-xl bg-accent px-5 py-3 font-bold text-black">
          Add places
        </Link>
      </div>
    );
  }

  const maxCuisine = i.topCuisines[0]?.count ?? 1;
  const maxVisitedCuisine = i.visitedCuisines[0]?.visits ?? 1;
  const maxPrice = Math.max(1, ...i.priceSpread.map((p) => p.count));

  return (
    <div className="flex flex-col gap-6 pt-2">
      <h1 className="text-2xl font-bold">Your food story 📊</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Places tracked" value={i.totalActive} />
        <Stat label="On the wishlist" value={i.totalWishlist} />
        <Stat label="Visits logged" value={i.totalVisits} />
        <Stat label="Takeout share" value={`${Math.round(i.takeoutShare * 100)}%`} />
      </div>

      {i.agreement && (
        <div className="rounded-2xl border border-accent bg-accent-soft/30 p-4 text-center">
          <p className="text-sm text-muted">Most aligned tastes</p>
          <p className="text-lg font-bold">
            {profileById.get(i.agreement.a.id)?.emoji} {i.agreement.a.name} &{" "}
            {profileById.get(i.agreement.b.id)?.emoji} {i.agreement.b.name}
          </p>
          <p className="text-xs text-muted">agree on {i.agreement.sharedRatings} shared ratings</p>
        </div>
      )}

      {i.visitedCuisines.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-4">
          <h2 className="font-bold">Where you actually go</h2>
          {i.visitedCuisines.map((c) => (
            <Bar key={c.cuisine} label={c.cuisine} value={c.visits} max={maxVisitedCuisine} />
          ))}
        </section>
      )}

      {i.topCuisines.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-4">
          <h2 className="font-bold">Your collection by cuisine</h2>
          {i.topCuisines.map((c) => (
            <Bar key={c.cuisine} label={c.cuisine} value={c.count} max={maxCuisine} />
          ))}
        </section>
      )}

      {i.mostVisited.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-4">
          <h2 className="font-bold">Most visited</h2>
          {i.mostVisited.map(({ restaurant, visits }) => (
            <Link
              key={restaurant.id}
              href={`/restaurants/${restaurant.id}`}
              className="flex justify-between text-sm"
            >
              <span className="truncate">{restaurant.name}</span>
              <span className="text-muted">
                {visits} visit{visits === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </section>
      )}

      {i.topRated.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-4">
          <h2 className="font-bold">Top rated</h2>
          {i.topRated.map(({ restaurant, avg }) => (
            <Link
              key={restaurant.id}
              href={`/restaurants/${restaurant.id}`}
              className="flex justify-between text-sm"
            >
              <span className="truncate">{restaurant.name}</span>
              <span className="text-muted">★ {avg.toFixed(1)}</span>
            </Link>
          ))}
        </section>
      )}

      {i.overdueFavorites.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-4">
          <h2 className="font-bold">Loved but neglected ⏰</h2>
          <p className="text-xs text-muted">High ratings, but it&apos;s been a while.</p>
          {i.overdueFavorites.map(({ restaurant, avg, days }) => (
            <Link
              key={restaurant.id}
              href={`/restaurants/${restaurant.id}`}
              className="flex justify-between text-sm"
            >
              <span className="truncate">
                {restaurant.name} <span className="text-muted">★ {avg.toFixed(1)}</span>
              </span>
              <span className="text-muted">{days}d ago</span>
            </Link>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-4">
        <h2 className="font-bold">Price mix</h2>
        {i.priceSpread.map((p) => (
          <Bar key={p.price} label={PRICE_LABELS[p.price - 1]} value={p.count} max={maxPrice} />
        ))}
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-4">
        <h2 className="font-bold">Who rates what</h2>
        {i.perProfile.map(({ profile, rated, avg }) => (
          <div key={profile.id} className="flex items-center justify-between text-sm">
            <span>
              {profile.emoji} {profile.name}
            </span>
            <span className="text-muted">
              {rated} rated{rated > 0 ? ` · avg ${avg.toFixed(1)}` : ""}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
