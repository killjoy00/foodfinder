"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loginAdmin, logoutAdmin, requireAdmin } from "@/lib/admin";
import { registry } from "@/lib/data";
import { AdminCatalogPatch, CatalogInput } from "@/lib/data/adapter";
import { hashPassword } from "@/lib/password";
import { RATE_LIMITED_MESSAGE, allowRequest } from "@/lib/rateLimit";

export async function adminLoginAction(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  if (!(await allowRequest("admin-login", 10, 5 * 60_000))) return { error: RATE_LIMITED_MESSAGE };
  const ok = await loginAdmin(String(formData.get("secret") ?? ""));
  if (!ok) return { error: "That's not the admin secret." };
  redirect("/admin");
}

export async function adminLogoutAction(): Promise<void> {
  await logoutAdmin();
  redirect("/admin/login");
}

export async function adminRenameGroupAction(
  id: string,
  formData: FormData
): Promise<{ error: string } | null> {
  await requireAdmin();
  const result = await registry().renameHousehold(id, String(formData.get("name") ?? ""));
  if (!result.ok) return { error: result.error ?? "Couldn't rename that group." };
  revalidatePath("/admin");
  revalidatePath(`/admin/groups/${id}`);
  return null;
}

export async function adminResetGroupPasswordAction(
  id: string,
  formData: FormData
): Promise<{ error: string } | null> {
  await requireAdmin();
  const password = String(formData.get("password") ?? "");
  if (password.length < 4) return { error: "Pick a password (4+ characters)." };
  await registry().setHouseholdPassword(id, await hashPassword(password));
  return null;
}

export async function adminDeleteGroupAction(id: string): Promise<void> {
  await requireAdmin();
  await registry().deleteHousehold(id);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function adminUpdateCatalogRowAction(
  id: string,
  patch: AdminCatalogPatch
): Promise<void> {
  await requireAdmin();
  await registry().updateCatalogRow(id, patch);
  revalidatePath("/admin/catalog");
  revalidatePath("/restaurants/browse");
}

export async function adminDeleteCatalogRowAction(id: string): Promise<void> {
  await requireAdmin();
  await registry().deleteCatalogRow(id);
  revalidatePath("/admin/catalog");
  revalidatePath("/restaurants/browse");
}

export async function adminImportCatalogAction(entries: CatalogInput[]): Promise<number> {
  await requireAdmin();
  const added = await registry().addCatalogEntries(entries.slice(0, 6000));
  revalidatePath("/admin/catalog");
  revalidatePath("/restaurants/browse");
  return added;
}
