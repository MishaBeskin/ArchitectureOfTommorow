"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminEnv, getServerEnv } from "@/env";
import { handleLogin, type LoginResult, type LoginState } from "@/server/auth/login";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { getDb } from "@/server/db/client";

function field(data: FormData, name: string, max: number): string {
  const value = data.get(name);
  return typeof value === "string" ? value.slice(0, max) : "";
}

/** Receives the sign-in form. The decisions live in handleLogin; this wires in the real services. */
export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = field(formData, "email", 254);
  const password = field(formData, "password", 1_100);
  const next = field(formData, "next", 500);

  let result: LoginResult;
  try {
    const requestHeaders = await headers();
    // x-forwarded-for is only trustworthy behind a proxy that sets it, such as Vercel.
    const ip =
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "unknown";
    const admin = getAdminEnv();
    const server = getServerEnv();

    result = await handleLogin(
      {
        db: getDb(),
        adminEmail: admin.ADMIN_EMAIL,
        rateLimitMax: admin.ADMIN_LOGIN_RATE_LIMIT_MAX,
        ipHashKey: server.SUPABASE_SECRET_KEY,
        supabase: await createSupabaseServerClient(),
        log: console,
      },
      { email, password, next: next || null, ip },
    );
  } catch (error) {
    console.error("Admin sign-in failed", error);
    return { status: "error", message: "Sign-in is unavailable right now. Please try again in a moment.", email };
  }

  // redirect() works by throwing, so it must stay outside the try block above.
  if (result.status === "success") redirect(result.redirectTo);
  return result;
}
