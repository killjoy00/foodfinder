import { NextRequest, NextResponse } from "next/server";
import { passwordHash } from "@/lib/auth";
import { DEMO_HOUSEHOLD_ID, isDemoMode, registry } from "@/lib/data";
import { ApiError, handle, readJson } from "@/lib/mobileApi";
import { signHouseholdToken } from "@/lib/token";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { group, password } = await readJson<{ group?: string; password?: string }>(req);
    const trimmed = (group ?? "").trim();
    if (trimmed.length < 2) throw new ApiError(400, "Pick a group name (2+ characters).");
    if ((password ?? "").length < 4) throw new ApiError(400, "Pick a password (4+ characters).");
    if (isDemoMode()) {
      const household = await registry().getHousehold(DEMO_HOUSEHOLD_ID);
      return NextResponse.json({
        token: signHouseholdToken(DEMO_HOUSEHOLD_ID),
        household,
        demo: true,
      });
    }
    const existing = await registry().findHouseholdByName(trimmed);
    if (existing) throw new ApiError(409, "That group name is already taken.");
    const household = await registry().createHousehold(trimmed, passwordHash(password!));
    return NextResponse.json({
      token: signHouseholdToken(household.id),
      household,
      demo: false,
    });
  });
}
