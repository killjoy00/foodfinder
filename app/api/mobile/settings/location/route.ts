import { NextRequest, NextResponse } from "next/server";
import { ApiError, handle, readJson, requireApiProfile } from "@/lib/mobileApi";
import { HomeLocationInput, saveHomeLocation } from "@/lib/services";

/** Set the home location from a ZIP code or manual coordinates. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const { adapter } = await requireApiProfile();
    const input = await readJson<HomeLocationInput>(req);
    const result = await saveHomeLocation(adapter, input);
    if (!result.ok) throw new ApiError(400, result.message);
    return NextResponse.json({
      message: result.message,
      settings: await adapter.getSettings(),
    });
  });
}
