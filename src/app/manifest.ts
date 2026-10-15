import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Architecture",
    description: "A showcase of new architecture projects.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#0a2848",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
