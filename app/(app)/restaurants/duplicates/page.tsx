import Link from "next/link";
import { db } from "@/lib/data";
import { findDuplicatePairs } from "@/lib/duplicates";
import { DuplicatesClient } from "@/components/DuplicatesClient";

export const dynamic = "force-dynamic";

export default async function DuplicatesPage() {
  const restaurants = await (await db()).listRestaurants();
  const pairs = findDuplicatePairs(restaurants).map((p) => ({
    a: summarize(p.a),
    b: summarize(p.b),
    reason: p.reason,
    confidence: p.confidence,
  }));

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <Link href="/restaurants" className="text-sm text-muted">
          ← All places
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Possible duplicates 🔁</h1>
      </div>
      {pairs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border-soft p-8 text-center text-muted">
          No likely duplicates found. 🎉
        </p>
      ) : (
        <DuplicatesClient pairs={pairs} />
      )}
    </div>
  );
}

function summarize(r: {
  id: string;
  name: string;
  cuisines: string[];
  price: number;
  status: string;
  address: string | null;
  visitCount: number;
  ratings: Record<string, number>;
  googlePlaceId: string | null;
}) {
  return {
    id: r.id,
    name: r.name,
    cuisines: r.cuisines,
    price: r.price,
    status: r.status,
    address: r.address,
    visitCount: r.visitCount,
    ratingCount: Object.keys(r.ratings).length,
    hasPlaceId: !!r.googlePlaceId,
  };
}
