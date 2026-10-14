import type { Metadata } from "next";
import { SITE_NAME } from "./site";

/**
 * The site-wide social image (app/opengraph-image.tsx). It has to be named explicitly: a page's
 * own `openGraph` replaces the layout's, and with it the file-based image Next attaches there.
 */
export const DEFAULT_SOCIAL_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: SITE_NAME };

interface PageMetadataInput {
  /** Omit on the home page, which uses the site name alone. */
  title?: string;
  description: string;
  /** Path of the canonical URL, e.g. "/about". Resolved against metadataBase. */
  path: string;
}

/**
 * Canonical URL plus matching Open Graph and Twitter tags. Next does not copy the page title into
 * og:title, and a page-level `openGraph` replaces the layout's, so each page states them in full.
 */
export function pageMetadata({ title, description, path }: PageMetadataInput): Metadata {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;

  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
      images: [DEFAULT_SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [DEFAULT_SOCIAL_IMAGE.url],
    },
  };
}
