import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/env";

/**
 * A Supabase client that reads and writes the visitor's session cookies. It uses the publishable
 * key, so it can only do what a signed-in user may; the secret key is never used for auth.
 * Create one per request: it must not be shared, as its cache headers apply to one response.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const env = getPublicEnv();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, which cannot set cookies. Harmless: the proxy
          // refreshes the session on every request, and actions and route handlers can set them.
        }
      },
    },
  });
}
