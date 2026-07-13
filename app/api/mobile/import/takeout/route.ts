import { NextRequest, NextResponse } from "next/server";
import { handle, readJson, requireApiProfile } from "@/lib/mobileApi";
import { importTakeout } from "@/lib/services";
import { TakeoutItem } from "@/lib/takeout";

/** Import Google Takeout items (parsed on-device with lib/takeout.ts). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const { adapter, profile } = await requireApiProfile();
    const { items } = await readJson<{ items?: TakeoutItem[] }>(req);
    const result = await importTakeout(adapter, profile.id, items ?? []);
    return NextResponse.json(result);
  });
}
