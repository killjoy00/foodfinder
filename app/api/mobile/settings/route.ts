import { NextRequest, NextResponse } from "next/server";
import { handle, readJson, requireApiAuth, requireApiProfile } from "@/lib/mobileApi";
import { Settings } from "@/lib/types";

export async function GET() {
  return handle(async () => {
    const adapter = await requireApiAuth();
    return NextResponse.json({ settings: await adapter.getSettings() });
  });
}

/** Save settings; unspecified fields keep their current values. */
export async function PUT(req: NextRequest) {
  return handle(async () => {
    const { adapter } = await requireApiProfile();
    const body = await readJson<Partial<Settings>>(req);
    const prev = await adapter.getSettings();
    const settings: Settings = { ...prev, ...body };
    await adapter.saveSettings(settings);
    return NextResponse.json({ settings });
  });
}
