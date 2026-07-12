import { NextRequest, NextResponse } from "next/server";
import { passwordHash } from "@/lib/auth";
import { isDemoMode, registry } from "@/lib/data";
import { getActiveHouseholdId } from "@/lib/household";
import { ApiError, handle, readJson } from "@/lib/mobileApi";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { password } = await readJson<{ password?: string }>(req);
    if ((password ?? "").length < 4) throw new ApiError(400, "Pick a password (4+ characters).");
    if (isDemoMode()) throw new ApiError(400, "Passwords aren't used in demo mode.");
    const id = await getActiveHouseholdId();
    if (!id) throw new ApiError(401, "You're not logged into a group.");
    await registry().setHouseholdPassword(id, passwordHash(password!));
    return NextResponse.json({ ok: true });
  });
}
