import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRobots, buildSitemap } from "./sitemap";
import { pageMetadata } from "./seo";
import { absoluteUrl, getSiteUrl } from "./site-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSiteUrl", () => {
  it("uses NEXT_PUBLIC_SITE_URL and normalises it to an origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.example.com/");
    expect(getSiteUrl()).toBe("https://www.example.com");

    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.example.com/some/path?x=1");
    expect(getSiteUrl()).toBe("https://www.example.com");
  });

  it("falls back to the Vercel production domain, then to localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "aot.vercel.app");
    expect(getSiteUrl()).toBe("https://aot.vercel.app");

    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("prefers the explicit URL over the Vercel one", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.example.com");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "aot.vercel.app");

    expect(getSiteUrl()).toBe("https://www.example.com");
  });

  it("fails loudly on an invalid URL instead of emitting broken canonicals", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not a url");

    expect(() => getSiteUrl()).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });
});

describe("absoluteUrl", () => {
  it("joins the origin and a path with or without a leading slash", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.example.com");

    expect(absoluteUrl("/about")).toBe("https://www.example.com/about");
    expect(absoluteUrl("about")).toBe("https://www.example.com/about");
  });
});

describe("pageMetadata", () => {
  it("sets the canonical path and states Open Graph and Twitter tags in full", () => {
    const meta = pageMetadata({ title: "About", description: "About us", path: "/about" });

    expect(meta.title).toBe("About");
    expect(meta.description).toBe("About us");
    expect(meta.alternates?.canonical).toBe("/about");
    expect(meta.openGraph).toMatchObject({
      title: "About | Architecture of Tomorrow",
      description: "About us",
      url: "/about",
      siteName: "Architecture of Tomorrow",
      type: "website",
    });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", title: "About | Architecture of Tomorrow" });
  });

  it("names the default social image explicitly, because a page's openGraph replaces the layout's", () => {
    const meta = pageMetadata({ title: "About", description: "About us", path: "/about" });

    expect(meta.openGraph).toMatchObject({ images: [{ url: "/opengraph-image", width: 1200, height: 630 }] });
    expect(meta.twitter).toMatchObject({ images: ["/opengraph-image"] });
  });

  it("leaves the title to the site default on the home page", () => {
    const meta = pageMetadata({ description: "Home", path: "/" });

    expect(meta).not.toHaveProperty("title");
    expect(meta.openGraph).toMatchObject({ title: "Architecture of Tomorrow" });
  });
});

describe("buildSitemap", () => {
  const projects = [
    { slug: "a", updatedAt: new Date("2025-01-01T00:00:00Z") },
    { slug: "b", updatedAt: new Date("2026-03-01T00:00:00Z") },
  ];

  it("lists static pages and every project with absolute URLs", () => {
    const urls = buildSitemap("https://x.test", projects).map((e) => e.url);

    expect(urls).toEqual([
      "https://x.test",
      "https://x.test/projects",
      "https://x.test/projects/a",
      "https://x.test/projects/b",
      "https://x.test/about",
      "https://x.test/contact",
    ]);
  });

  it("uses each project's own update time and the newest one for the index pages", () => {
    const entries = buildSitemap("https://x.test", projects);
    const byUrl = Object.fromEntries(entries.map((e) => [e.url, e.lastModified]));

    expect(byUrl["https://x.test/projects/a"]).toEqual(new Date("2025-01-01T00:00:00Z"));
    expect(byUrl["https://x.test"]).toEqual(new Date("2026-03-01T00:00:00Z"));
    expect(byUrl["https://x.test/projects"]).toEqual(new Date("2026-03-01T00:00:00Z"));
  });

  it("omits dates it cannot know instead of inventing 'now'", () => {
    const entries = buildSitemap("https://x.test", []);

    expect(entries.map((e) => e.url)).toEqual([
      "https://x.test",
      "https://x.test/projects",
      "https://x.test/about",
      "https://x.test/contact",
    ]);
    expect(entries.every((e) => e.lastModified === undefined)).toBe(true);
  });
});

describe("buildRobots", () => {
  it("allows the site, blocks the admin and API, and points at the sitemap", () => {
    expect(buildRobots("https://x.test")).toEqual({
      rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
      sitemap: "https://x.test/sitemap.xml",
    });
  });
});
