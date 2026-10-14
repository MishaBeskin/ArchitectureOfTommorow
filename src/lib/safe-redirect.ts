export const DEFAULT_ADMIN_PATH = "/admin/projects";

/** Only plain paths under /admin: letters, digits and a few URL-safe characters. No query, no host. */
const ADMIN_PATH = /^\/admin(?:\/[A-Za-z0-9._~!$&'()*+,;=:@%-]*)*$/;

/** True for control characters (code points below 32), written without escape sequences. */
const hasControlCharacter = (text: string) => Array.from(text).some((char) => char.charCodeAt(0) < 32);

/**
 * Where to send the admin after signing in. `next` comes from the URL, so it is untrusted: an
 * attacker could link to /admin/login?next=//evil.example to bounce a freshly signed-in admin to
 * a look-alike site. Anything that is not a plain /admin path falls back to the default.
 */
export function safeAdminRedirect(next: string | null | undefined): string {
  if (!next) return DEFAULT_ADMIN_PATH;
  const value = next.trim();
  if (!ADMIN_PATH.test(value)) return DEFAULT_ADMIN_PATH;

  // The same checks again on the decoded form, which is what a browser or server would act on.
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return DEFAULT_ADMIN_PATH;
  }
  if (decoded.includes("..") || decoded.includes("//") || decoded.includes("\\") || hasControlCharacter(decoded)) {
    return DEFAULT_ADMIN_PATH;
  }
  if (!decoded.startsWith("/admin")) return DEFAULT_ADMIN_PATH;

  // Returning to the sign-in page after signing in would loop.
  if (decoded === "/admin/login" || decoded.startsWith("/admin/login/")) return DEFAULT_ADMIN_PATH;
  return value;
}
