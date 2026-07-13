import { NextRequest, NextResponse } from "next/server";
import { ApiError, handle, readJson, requireApiAuth } from "@/lib/mobileApi";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const adapter = await requireApiAuth();
    const { id } = await params;
    const body = await readJson<{ name?: string; emoji?: string; color?: string }>(req);
    const name = (body.name ?? "").trim();
    if (!name) throw new ApiError(400, "A profile needs a name.");
    await adapter.updateProfile(id, {
      name,
      emoji: (body.emoji ?? "🙂").trim() || "🙂",
      color: body.color ?? "#f97316",
    });
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const adapter = await requireApiAuth();
    const { id } = await params;
    await adapter.deleteProfile(id);
    return NextResponse.json({ ok: true });
  });
}
