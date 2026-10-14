import type { NextConfig } from "next";
import { SECURITY_HEADERS, adminCsp, publicCsp } from "./src/lib/csp";

// Project images live in the public "projects" bucket of the Supabase project; allow only that path.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : undefined;
const supabaseHost = supabaseUrl?.hostname;

const nextConfig: NextConfig = {
  /* config options here */
  // The X-Powered-By header tells attackers which framework to target and helps nobody else.
  poweredByHeader: false,
  async headers() {
    const csp = {
      supabaseOrigin: supabaseUrl?.origin,
      https: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
      dev: process.env.NODE_ENV === "development",
    };
    return [
      { source: "/(.*)", headers: [...SECURITY_HEADERS] },
      // Admin and the public site differ: no Turnstile in admin, uploads to Supabase allowed.
      {
        source: "/((?!admin|api/admin).*)",
        headers: [{ key: "Content-Security-Policy", value: publicCsp(csp) }],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "Content-Security-Policy", value: adminCsp(csp) }],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // The whole stylesheet is about 8 KB. Inlining it removes a render-blocking request, which is
    // the biggest avoidable delay before first paint for a first-time visitor on a slow connection.
    inlineCss: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/projects/**",
          },
        ]
      : [],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
