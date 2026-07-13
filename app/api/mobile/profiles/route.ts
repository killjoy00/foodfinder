import { NextRequest, NextResponse } from "next/server";
import { ApiError, handle, readJson, requireApiAuth } from "@/lib/mobileApi";

export async function GET() {
  return handle(async () => {
    const adapter = await requireApiAuth();
    return NextResponse.json({ profiles: await adapter.listProfiles() });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const adapter = await requireApiAuth();
    const body = await readJson<{ name?: string; emoji?: string; color?: string }>(req);
    const name = (body.name ?? "").trim();
    if (!name) throw new ApiError(400, "A profile needs a name.");
    const profile = await adapter.createProfile(
      name,
      (body.emoji ?? "🙂").trim() || "🙂",
      body.color ?? "#f97316"
    );
    return NextResponse.json({ profile });
  });
}
