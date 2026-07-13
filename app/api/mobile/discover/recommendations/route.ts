import { NextRequest, NextResponse } from "next/server";
import { ApiError, handle, requireApiProfile } from "@/lib/mobileApi";
import { fetchRecommendationGroups } from "@/lib/services";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const { adapter } = await requireApiProfile();
    const radius = Number(req.nextUrl.searchParams.get("radius")) || undefined;
    const result = await fetchRecommendationGroups(adapter, radius);
    if (!result.ok) throw new ApiError(400, result.error);
    return NextResponse.json({ groups: result.groups });
  });
}
