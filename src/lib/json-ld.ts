import type { Project } from "./types";
import { formatProjectType } from "./format";
import { SITE_NAME } from "./site";

type JsonLd = Record<string, unknown>;

const CONTEXT = "https://schema.org";

export function organizationJsonLd(siteUrl: string): JsonLd {
  return { "@context": CONTEXT, "@type": "Organization", name: SITE_NAME, url: siteUrl };
}

export function websiteJsonLd(siteUrl: string): JsonLd {
  return { "@context": CONTEXT, "@type": "WebSite", name: SITE_NAME, url: siteUrl, inLanguage: "en" };
}

/** `path` is site-relative ("/projects"); the last item may omit it, as it is the current page. */
export function breadcrumbJsonLd(siteUrl: string, items: Array<{ name: string; path: string }>): JsonLd {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${siteUrl}${item.path}`,
    })),
  };
}

export function projectJsonLd(siteUrl: string, project: Project): JsonLd {
  const url = `${siteUrl}/projects/${project.slug}`;
  const { location } = project;

  return {
    "@context": CONTEXT,
    "@type": "CreativeWork",
    "@id": url,
    url,
    name: project.title,
    description: project.summary,
    genre: formatProjectType(project.type),
    dateCreated: String(project.year),
    ...(project.publishedAt ? { datePublished: project.publishedAt.toISOString() } : {}),
    dateModified: project.updatedAt.toISOString(),
    inLanguage: "en",
    ...(project.images.length > 0 ? { image: project.images.map((image) => image.url) } : {}),
    ...(project.architects.length > 0
      ? {
          creator: project.architects.map((architect) => ({
            "@type": "Organization",
            name: architect.name,
            ...(architect.websiteUrl ? { url: architect.websiteUrl } : {}),
          })),
        }
      : {}),
    locationCreated: {
      "@type": "Place",
      name: location.city,
      address: {
        "@type": "PostalAddress",
        addressLocality: location.city,
        ...(location.region ? { addressRegion: location.region } : {}),
        addressCountry: location.countryCode,
      },
      ...(location.lat !== null && location.lng !== null
        ? { geo: { "@type": "GeoCoordinates", latitude: location.lat, longitude: location.lng } }
        : {}),
    },
  };
}

/**
 * JSON for an inline <script>. Text from the admin can contain "</script>", so "<" is escaped
 * (the result is still valid JSON), as are the line separators JavaScript treats as newlines.
 */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  // Built from code points: a literal U+2028/U+2029 in source would end a string or regex literal.
  const lineSeparator = String.fromCharCode(0x2028);
  const paragraphSeparator = String.fromCharCode(0x2029);

  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .split(lineSeparator)
    .join("\\u2028")
    .split(paragraphSeparator)
    .join("\\u2029");
}
