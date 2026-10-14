/*
 * Security headers and Content Security Policies. Plain functions with no imports, so next.config.ts
 * can use them and the tests can check the exact strings.
 *
 * Two fixed policies. A nonce-based one (a fresh secret per request that every allowed script must
 * carry) would be stricter, but it cannot work here: Next.js prerenders a static shell for every page,
 * admin included, and a static shell has no request to take a nonce from, so its own scripts would be
 * blocked and the pages would not load. Both policies therefore allow inline scripts, which Next's
 * bootstrap code needs, and instead close everything else: scripts only from this site (plus
 * Turnstile on the public pages), no plugins, no framing, no base-tag changes, forms to this site only.
 */

export interface CspOptions {
  /** Origin of the Supabase project, e.g. https://abc.supabase.co. Images and uploads come from it. */
  supabaseOrigin?: string;
  /** Only upgrade http to https when the site itself is served over https (not on localhost). */
  https: boolean;
  /** Development needs 'unsafe-eval' for React's debugging; production never does. */
  dev?: boolean;
}

const TURNSTILE = "https://challenges.cloudflare.com";

const join = (directives: Array<string | false | undefined>) =>
  directives.filter((d): d is string => typeof d === "string" && d !== "").join("; ");

/** Directives shared by both policies. */
function common({ supabaseOrigin, https }: CspOptions) {
  return [
    "default-src 'self'",
    `img-src 'self' data: blob:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
    "font-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    https && "upgrade-insecure-requests",
  ];
}

/** For the public site: fixed, because prerendered pages cannot carry a nonce. */
export function publicCsp(options: CspOptions): string {
  return join([
    ...common(options),
    `script-src 'self' 'unsafe-inline' ${TURNSTILE}${options.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // The Turnstile widget runs in an iframe and talks to Cloudflare.
    `frame-src ${TURNSTILE}`,
    `connect-src 'self' ${TURNSTILE}`,
  ]);
}

/** For /admin: like the public policy but with no third-party script, frame or connection at all. */
export function adminCsp(options: CspOptions): string {
  const { supabaseOrigin, dev } = options;
  return join([
    ...common(options),
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "frame-src 'none'",
    // Browser uploads go straight to Supabase Storage.
    `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  ]);
}

/** Sent on every response. */
export const SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  // Browsers ignore this over plain http, so it is harmless on localhost.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing on this site needs the camera, microphone, location or ad-tracking features.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // The CSP's frame-ancestors does this too; this covers browsers that only know the old header.
  { key: "X-Frame-Options", value: "DENY" },
];
