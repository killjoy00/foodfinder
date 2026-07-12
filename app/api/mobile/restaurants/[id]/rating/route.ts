import { NextRequest, NextResponse } from "next/server";
import { ApiError, handle, readJson, requireApiProfile } from "@/lib/mobileApi";

type Params = { params: Promise<{ id: string }> };

/** Set (score 1–10) or clear (score null) one person's rating of a brand. */
export async function PUT(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { adapter } = await requireApiProfile();
    const { id } = await params;
    const { profileId, score } = await readJson<{ profileId?: string; score?: number | null }>(req);
    if (!profileId) throw new ApiError(400, "profileId is required.");
    if (score === null || score === undefined) {
      await adapter.clearRating(id, profileId);
    } else {
      if (score < 1 || score > 10) throw new ApiError(400, "Scores go from 1 to 10.");
      await adapter.setRating(id, profileId, Math.round(score));
    }
    return NextResponse.json({ restaurant: await adapter.getRestaurant(id) });
  });
}
