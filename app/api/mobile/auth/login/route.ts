import { NextRequest, NextResponse } from "next/server";
import { passwordHash } from "@/lib/auth";
import { DEMO_HOUSEHOLD_ID, isDemoMode, registry } from "@/lib/data";
import { ApiError, handle, readJson } from "@/lib/mobileApi";
import { signHouseholdToken } from "@/lib/token";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { group, password } = await readJson<{ group?: string; password?: string }>(req);
    if (isDemoMode()) {
      const household = await registry().getHousehold(DEMO_HOUSEHOLD_ID);
      return NextResponse.json({
        token: signHouseholdToken(DEMO_HOUSEHOLD_ID),
        household,
        demo: true,
      });
    }
    const found = await registry().findHouseholdByName(group ?? "");
    if (!found || found.passwordHash !== passwordHash(password ?? "")) {
      throw new ApiError(401, "That group name and password don't match.");
    }
    return NextResponse.json({
      token: signHouseholdToken(found.id),
      household: { id: found.id, name: found.name },
      demo: false,
    });
  });
}
