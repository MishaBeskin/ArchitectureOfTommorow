"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/server/auth/supabase";

/**
 * Ends this browser's session only (scope "local"), so signing out here does not also sign the
 * admin out on other devices. It needs no admin check: anyone may end their own session.
 */
export async function logout(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/admin/login");
}
