/**
 * The public origin used for canonical URLs, the sitemap and structured data.
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://example.com). On Vercel the production
 * domain is picked up automatically; otherwise it falls back to localhost for development.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const raw = explicit || (vercel ? `https://${vercel}` : "http://localhost:3000");

  try {
    // Normalise to an origin so a stray path or trailing slash cannot produce "//" in URLs.
    return new URL(raw).origin;
  } catch {
    throw new Error(`NEXT_PUBLIC_SITE_URL is not a valid URL: "${raw}"`);
  }
}

/** "/projects/x" -> "https://example.com/projects/x". */
export function absoluteUrl(path: string): string {
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
