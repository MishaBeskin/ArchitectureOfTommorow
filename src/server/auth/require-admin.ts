import "server-only";
import { redirect } from "next/navigation";
import { getAdminEnv } from "@/env";
import { getAdminFromClient, type AdminIdentity } from "./admin";
import { createSupabaseServerClient } from "./supabase";

/** The signed-in admin, or null. For route handlers, which should answer 401 rather than redirect. */
export async function getAdmin(): Promise<AdminIdentity | null> {
  const { ADMIN_EMAIL } = getAdminEnv();
  return getAdminFromClient(await createSupabaseServerClient(), ADMIN_EMAIL);
}

/**
 * The real security boundary. Call it first in every admin page, layout, server action and
 * upload route. The proxy only redirects early for convenience; this decides.
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
