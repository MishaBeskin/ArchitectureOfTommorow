import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/env";
import { safeAdminRedirect } from "@/lib/safe-redirect";
import { isAdminUser } from "@/server/auth/admin";
import { authCookieOptions } from "@/server/auth/cookies";

/**
 * Runs before every /admin request. It does two jobs: it keeps the Supabase session fresh (the
 * cookies it sets are what stop an hour-old token from expiring mid-session), and it sends
 * visitors who are not the admin to the sign-in page with a real redirect, before any admin page
 * renders. It is a convenience, not the security boundary: every admin page, layout, action and
 * route also calls requireAdmin(), so a bug or bypass here cannot expose anything.
 */
export async function proxy(request: NextRequest) {
  const env = getPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        // Later code in this same request must see the refreshed tokens, not the stale ones.
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, authCookieOptions(options));
        // Responses that set auth cookies must never be cached by a CDN.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // getUser() validates the token with Supabase's Auth server (and refreshes it if it expired).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = isAdminUser(user, process.env.ADMIN_EMAIL ?? "");

  const { pathname } = request.nextUrl;
  const onLoginPage = pathname === "/admin/login";
  let result = response;

  if (!admin && !onLoginPage) {
    const login = request.nextUrl.clone();
    login.pathname = "/admin/login";
    login.search = "";
    login.searchParams.set("next", safeAdminRedirect(pathname));
    result = NextResponse.redirect(login);
  } else if (admin && onLoginPage) {
    const destination = request.nextUrl.clone();
    destination.pathname = safeAdminRedirect(request.nextUrl.searchParams.get("next"));
    destination.search = "";
    result = NextResponse.redirect(destination);
  }

  if (result !== response) {
    // Keep any cookie the session refresh just set, or the redirect would drop the new tokens.
    for (const cookie of response.cookies.getAll()) result.cookies.set(cookie);
  }
  result.headers.set("X-Robots-Tag", "noindex, nofollow");
  result.headers.set("Cache-Control", "private, no-store");
  return result;
}

export const config = {
  matcher: ["/admin/:path*"],
};
