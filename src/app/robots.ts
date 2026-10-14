import type { MetadataRoute } from "next";
import { buildRobots } from "@/lib/sitemap";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return buildRobots(getSiteUrl());
}
