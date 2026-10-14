import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAdminEnv } from "@/env";
import { getAdminFromClient, type AdminIdentity } from "./admin";
import { createSupabaseServerClient } from "./supabase";

/** The signed-in admin, or null. For route handlers, which should answer 401 rather than redirect. */
export async function getAdmin(): Promise<AdminIdentity | null> {
  // Request-time only. Without this, Next.js may run the check while pre-rendering a page shell
  // (with Partial Prefetching it can read cookies there), where the Supabase client's clock reads
  // are rejected, and it must never run while the site is being built. connection() comes first,
  // so nothing below it (cookies, ADMIN_EMAIL, the Auth call) is evaluated ahead of a real request.
  await connection();
  const supabase = await createSupabaseServerClient();
  const { ADMIN_EMAIL } = getAdminEnv();
  return getAdminFromClient(supabase, ADMIN_EMAIL);
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
