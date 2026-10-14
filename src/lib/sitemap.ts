import type { MetadataRoute } from "next";

export interface SitemapProject {
  slug: string;
  updatedAt: Date;
}

/** Static pages plus every published project. Dates come from the data, never from "now". */
export function buildSitemap(siteUrl: string, projects: SitemapProject[]): MetadataRoute.Sitemap {
  const newest = projects.reduce<Date | undefined>(
    (latest, project) => (!latest || project.updatedAt > latest ? project.updatedAt : latest),
    undefined,
  );

  return [
    { url: siteUrl, lastModified: newest, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/projects`, lastModified: newest, changeFrequency: "weekly", priority: 0.9 },
    ...projects.map((project) => ({
      url: `${siteUrl}/projects/${project.slug}`,
      lastModified: project.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${siteUrl}/about`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${siteUrl}/contact`, changeFrequency: "yearly", priority: 0.3 },
  ];
}

export function buildRobots(siteUrl: string): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
