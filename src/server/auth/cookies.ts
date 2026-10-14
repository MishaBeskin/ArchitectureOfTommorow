import { getSiteUrl } from "@/lib/site-url";

interface CookieOptionsLike {
  [key: string]: unknown;
}

/**
 * Hardened settings for the session cookies. Supabase's defaults leave them readable by page
 * scripts because its browser client needs that; this app never uses the browser client, so the
 * cookies can be HttpOnly, which keeps a script injected into the page from stealing the session.
 * Strict SameSite means the cookie is never sent on requests started by another site.
 */
export function authCookieOptions(options: CookieOptionsLike = {}): CookieOptionsLike {
  return {
    ...options,
    httpOnly: true,
    sameSite: "strict",
    // Secure cookies need https; plain-http localhost (development, tests) cannot set them.
    secure: getSiteUrl().startsWith("https:"),
    path: "/",
  };
}
