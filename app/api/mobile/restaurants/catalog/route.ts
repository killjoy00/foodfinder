import { NextRequest, NextResponse } from "next/server";
import { CatalogInput } from "@/lib/data/adapter";
import { handle, readJson, requireApiAuth, requireApiProfile } from "@/lib/mobileApi";

/** The shared master catalog, flagged with what this group already tracks. */
export async function GET() {
  return handle(async () => {
    const adapter = await requireApiAuth();
    return NextResponse.json({ catalog: await adapter.listCatalog() });
  });
}

/** Bulk-add rows to the shared catalog (e.g. a Takeout import), skipping dupes. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const { adapter } = await requireApiProfile();
    const { entries } = await readJson<{ entries?: CatalogInput[] }>(req);
    const added = await adapter.addCatalogEntries((entries ?? []).slice(0, 6000));
    return NextResponse.json({ added });
  });
}
