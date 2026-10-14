import type { MetadataRoute } from "next";
import { buildSitemap } from "@/lib/sitemap";
import { getSiteUrl } from "@/lib/site-url";
import { getSitemapEntries } from "@/server/queries/projects";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemap(getSiteUrl(), await getSitemapEntries());
}
