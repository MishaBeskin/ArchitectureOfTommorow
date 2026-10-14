import { expect, test, type Page } from "@playwright/test";

// Reads the seeded sample projects (pnpm db:seed). The test server runs with
// NEXT_PUBLIC_SITE_URL=http://localhost:3100 (see playwright.config.ts).

const ORIGIN = "http://localhost:3100";
const PUBLISHED_SLUGS = [
  "casa-jacaranda-hotel",
  "cascadia-transit-hub",
  "delta-flood-park",
  "harbour-light-library",
  "kansai-timber-school",
  "savanna-civic-hall",
  "terrace-houses-alfama",
  "yarra-market-quarter",
];

const meta = (page: Page, selector: string) => page.locator(selector).first().getAttribute("content");

async function jsonLd(page: Page): Promise<Array<Record<string, unknown>>> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  // Each block is one document or an array of documents; both are valid JSON-LD.
  return blocks.flatMap((text) => {
    const parsed = JSON.parse(text) as Record<string, unknown> | Array<Record<string, unknown>>;
    return Array.isArray(parsed) ? parsed : [parsed];
  });
}

test.describe("crawler files", () => {
  test("sitemap.xml lists the static pages and every published project, with absolute URLs", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    const xml = await response.text();

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("xml");
    for (const path of ["", "/projects", "/about", "/contact"]) {
      expect(xml).toContain(`<loc>${ORIGIN}${path}</loc>`);
    }
    for (const slug of PUBLISHED_SLUGS) expect(xml).toContain(`<loc>${ORIGIN}/projects/${slug}</loc>`);
    expect(xml.match(/<loc>/g)).toHaveLength(4 + PUBLISHED_SLUGS.length);
  });

  test("sitemap.xml never lists the draft and gives projects a last-modified date", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();

    expect(xml).not.toContain("unpublished-draft-pavilion");
    expect(xml).toMatch(/projects\/harbour-light-library<\/loc>\s*<lastmod>\d{4}-\d{2}-\d{2}T/);
  });

  test("robots.txt allows the site, blocks the admin and points at the sitemap", async ({ request }) => {
    const response = await request.get("/robots.txt");
    const text = await response.text();

    expect(response.status()).toBe(200);
    expect(text).toMatch(/User-Agent: \*/i);
    expect(text).toMatch(/Allow: \//);
    expect(text).toMatch(/Disallow: \/admin/);
    expect(text).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });

  test("the web manifest and favicon are served", async ({ request }) => {
    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.status()).toBe(200);
    expect(await manifest.json()).toMatchObject({ name: "Architecture of Tomorrow", start_url: "/" });

    const icon = await request.get("/icon.svg");
    expect(icon.status()).toBe(200);
    expect(icon.headers()["content-type"]).toContain("svg");
  });

  test("the default social image is a 1200x630 PNG", async ({ request }) => {
    const response = await request.get("/opengraph-image");
    const body = await response.body();

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
    // PNG header: width and height are big-endian 32-bit integers at bytes 16 and 20.
    expect(body.readUInt32BE(16)).toBe(1200);
    expect(body.readUInt32BE(20)).toBe(630);
  });
});

test.describe("page metadata", () => {
  for (const { path, canonical } of [
    // The origin with and without a trailing slash is the same URL; Next writes it without.
    { path: "/", canonical: ORIGIN },
    { path: "/about", canonical: `${ORIGIN}/about` },
    { path: "/contact", canonical: `${ORIGIN}/contact` },
    { path: "/projects", canonical: `${ORIGIN}/projects` },
    { path: "/projects/harbour-light-library", canonical: `${ORIGIN}/projects/harbour-light-library` },
  ]) {
    test(`${path} has an absolute canonical URL, a description, one h1 and lang=en`, async ({ page }) => {
      await page.goto(path);

      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonical);
      expect(await meta(page, 'meta[name="description"]')).toBeTruthy();
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      expect(await meta(page, 'meta[property="og:url"]')).toBe(canonical);
    });
  }

  test("filtered and paginated list views canonicalise to /projects and are noindex", async ({ page }) => {
    await page.goto("/projects?type=civic");

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${ORIGIN}/projects`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("the home page has Open Graph and Twitter tags with the default image", async ({ page }) => {
    await page.goto("/");

    expect(await meta(page, 'meta[property="og:title"]')).toBe("Architecture of Tomorrow");
    expect(await meta(page, 'meta[property="og:type"]')).toBe("website");
    expect(await meta(page, 'meta[property="og:site_name"]')).toBe("Architecture of Tomorrow");
    expect(await meta(page, 'meta[property="og:image"]')).toContain(`${ORIGIN}/opengraph-image`);
    expect(await meta(page, 'meta[name="twitter:card"]')).toBe("summary_large_image");
  });

  test("a project's social preview uses its own title, summary and cover image", async ({ page }) => {
    await page.goto("/projects/harbour-light-library");

    expect(await meta(page, 'meta[property="og:title"]')).toBe("Harbour Light Library | Architecture of Tomorrow");
    expect(await meta(page, 'meta[property="og:description"]')).toContain("stepped reading terraces");
    const image = await meta(page, 'meta[property="og:image"]');
    expect(image).toMatch(/^https:\/\/.+\/storage\/v1\/object\/public\/projects\/seed\/harbour-light-library\/1\.webp$/);
    expect(await meta(page, 'meta[property="og:image:width"]')).toBe("1600");
    expect(await meta(page, 'meta[property="og:image:alt"]')).toBeTruthy();
    expect(await meta(page, 'meta[name="twitter:image"]')).toBe(image);
    // The cover replaces the site default instead of being added next to it.
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  });

  test("a project page uses its own title in the tab", async ({ page }) => {
    await page.goto("/projects/kansai-timber-school");

    await expect(page).toHaveTitle("Kansai Timber School | Architecture of Tomorrow");
  });
});

test.describe("structured data", () => {
  test("every public page declares the organization and the website", async ({ page }) => {
    for (const path of ["/", "/about", "/projects/harbour-light-library"]) {
      await page.goto(path);
      const types = (await jsonLd(page)).map((d) => d["@type"]);

      expect(types, path).toContain("Organization");
      expect(types, path).toContain("WebSite");
    }
  });

  test("a project page has a breadcrumb trail and a CreativeWork with its facts", async ({ page }) => {
    await page.goto("/projects/harbour-light-library");
    const docs = await jsonLd(page);

    const breadcrumb = docs.find((d) => d["@type"] === "BreadcrumbList") as {
      itemListElement: Array<{ position: number; name: string; item: string }>;
    };
    expect(breadcrumb.itemListElement.map((i) => [i.position, i.name, i.item])).toEqual([
      [1, "Home", `${ORIGIN}/`],
      [2, "Projects", `${ORIGIN}/projects`],
      [3, "Harbour Light Library", `${ORIGIN}/projects/harbour-light-library`],
    ]);

    const work = docs.find((d) => d["@type"] === "CreativeWork") as Record<string, unknown> & {
      creator: Array<{ name: string }>;
      image: string[];
    };
    expect(work).toMatchObject({
      name: "Harbour Light Library",
      url: `${ORIGIN}/projects/harbour-light-library`,
      dateCreated: "2025",
      genre: "Cultural",
    });
    expect(work.creator.map((c) => c.name)).toEqual(["Studio Nordlys"]);
    expect(work.image).toHaveLength(4);
  });

  test("the structured data of every project is valid JSON with no undefined values", async ({ page }) => {
    for (const slug of PUBLISHED_SLUGS) {
      await page.goto(`/projects/${slug}`);
      const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();

      expect(blocks.length, slug).toBeGreaterThanOrEqual(2);
      for (const block of blocks) {
        expect(() => JSON.parse(block), slug).not.toThrow();
        expect(block).not.toContain("undefined");
      }
    }
  });
});
