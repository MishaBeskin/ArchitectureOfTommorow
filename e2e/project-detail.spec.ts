import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// These tests read the seeded sample projects (pnpm db:seed).
// harbour-light-library: 4 images, caption on the first, previous slug "harbour-library".

const SLUG = "harbour-light-library";
const open = (page: Page) => page.goto(`/projects/${SLUG}`);
const lightbox = (page: Page) => page.getByRole("dialog", { name: "Harbour Light Library images" });
const openers = (page: Page) => page.getByRole("button", { name: /Open larger view/ });

test("shows the title, summary, breadcrumbs, description and details", async ({ page }) => {
  await open(page);

  await expect(page.getByRole("heading", { level: 1, name: "Harbour Light Library" })).toBeVisible();
  await expect(page.getByText("A public library whose stepped reading terraces")).toBeVisible();

  const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(crumbs.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  await expect(crumbs.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/projects");
  await expect(crumbs.getByText("Harbour Light Library")).toHaveAttribute("aria-current", "page");

  await expect(page.getByRole("heading", { level: 2, name: "About this project" })).toBeVisible();
  await expect(page.getByText("Harbour Light Library turns a former customs shed")).toBeVisible();

  const details = page.getByRole("complementary", { name: "Details" });
  await expect(details.getByText("Studio Nordlys")).toBeVisible();
  await expect(details.getByText("Copenhagen, Denmark")).toBeVisible();
  await expect(details.getByText("2025")).toBeVisible();
  await expect(details.getByText("Cultural")).toBeVisible();
  await expect(details.getByText("Completed")).toBeVisible();
});

test("the document title and description come from the project", async ({ page }) => {
  await open(page);

  await expect(page).toHaveTitle("Harbour Light Library | Architecture of Tomorrow");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /A public library whose stepped reading terraces/,
  );
});

test("the lead image loads and is preloaded, with the other images as thumbnails", async ({ page }) => {
  await open(page);

  await expect(openers(page)).toHaveCount(4);
  const lead = openers(page).first().locator("img");
  await expect.poll(() => lead.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  expect(await page.locator('link[rel="preload"][as="image"]').count()).toBeGreaterThan(0);
});

test("the lightbox opens, navigates, wraps around and returns focus on Escape", async ({ page }) => {
  await open(page);
  const opener = openers(page).first();

  await opener.click();
  await expect(lightbox(page)).toBeVisible();
  await expect(lightbox(page).getByText("Image 1 of 4")).toBeVisible();
  await expect(lightbox(page).getByText(/Placeholder image for development/)).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(lightbox(page).getByText("Image 2 of 4")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(lightbox(page).getByText("Image 4 of 4")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(lightbox(page)).toBeHidden();
  await expect(opener).toBeFocused();
});

test("the lightbox buttons work and the page behind does not scroll", async ({ page }) => {
  await open(page);
  await openers(page).nth(2).click();
  await expect(lightbox(page).getByText("Image 3 of 4")).toBeVisible();

  await lightbox(page).getByRole("button", { name: "Next image" }).click();
  await expect(lightbox(page).getByText("Image 4 of 4")).toBeVisible();
  await lightbox(page).getByRole("button", { name: "Next image" }).click();
  await expect(lightbox(page).getByText("Image 1 of 4")).toBeVisible();

  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe("hidden");

  await lightbox(page).getByRole("button", { name: "Close" }).click();
  await expect(lightbox(page)).toBeHidden();
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
});

test("the gallery is keyboard operable", async ({ page }) => {
  await open(page);

  await openers(page).first().focus();
  await page.keyboard.press("Enter");
  await expect(lightbox(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(lightbox(page)).toBeHidden();
});

test("shows related projects without the project itself or the draft", async ({ page }) => {
  await open(page);

  const related = page.getByRole("region", { name: "More projects" });
  await expect(related.getByRole("listitem")).toHaveCount(3);
  await expect(related.getByRole("link", { name: "Harbour Light Library" })).toHaveCount(0);
  await expect(related.getByText("Draft Pavilion")).toHaveCount(0);
});

test("a card on the list leads to its detail page", async ({ page }) => {
  await page.goto("/projects");

  await page.getByRole("link", { name: "Yarra Market Quarter" }).click();

  await expect(page).toHaveURL(/\/projects\/yarra-market-quarter$/);
  await expect(page.getByRole("heading", { level: 1, name: "Yarra Market Quarter" })).toBeVisible();
});

test.describe("status codes", () => {
  test("a renamed project's old slug returns 308 to the current URL", async ({ request }) => {
    const response = await request.get("/projects/harbour-library", { maxRedirects: 0 });

    expect(response.status()).toBe(308);
    // Next.js 16 sends the same Location twice on the first request for a slug (while it generates
    // the page); browsers accept identical duplicates and later requests have a single value.
    const targets = new Set(response.headers()["location"]!.split(/,\s*/));
    expect([...targets]).toEqual([`/projects/${SLUG}`]);
  });

  test("the old slug lands on the project in a browser", async ({ page }) => {
    await page.goto("/projects/harbour-library");

    await expect(page).toHaveURL(new RegExp(`/projects/${SLUG}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Harbour Light Library" })).toBeVisible();
  });

  test("an unknown slug returns a real 404 with a way back", async ({ page, request }) => {
    expect((await request.get("/projects/does-not-exist")).status()).toBe(404);

    await page.goto("/projects/does-not-exist");
    await expect(page.getByRole("heading", { name: "Project not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse all projects" })).toHaveAttribute("href", "/projects");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("an unpublished draft is a 404 and leaks nothing", async ({ page, request }) => {
    const response = await request.get("/projects/unpublished-draft-pavilion");

    expect(response.status()).toBe(404);
    expect(await response.text()).not.toContain("Draft Pavilion");

    await page.goto("/projects/unpublished-draft-pavilion");
    await expect(page.getByRole("heading", { name: "Project not found" })).toBeVisible();
  });
});

test("the server HTML already contains the content for crawlers and link previews", async ({ request }) => {
  const html = await (await request.get(`/projects/${SLUG}`)).text();

  expect(html).toContain("<h1");
  expect(html).toContain("Harbour Light Library");
  expect(html).toContain("Studio Nordlys");
  expect(html).toContain("turns a former customs shed into a public reading room");
});

test("has no horizontal scroll", async ({ page }) => {
  await open(page);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test.describe("accessibility", () => {
  const scan = (page: Page) => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();

  test("the page has no detectable violations", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("region", { name: "More projects" })).toBeVisible();

    expect((await scan(page)).violations).toEqual([]);
  });

  test("the open lightbox has no detectable violations", async ({ page }) => {
    await open(page);
    await openers(page).first().click();
    await expect(lightbox(page)).toBeVisible();

    expect((await scan(page)).violations).toEqual([]);
  });

  test("the not-found page has no detectable violations", async ({ page }) => {
    await page.goto("/projects/does-not-exist");
    await expect(page.getByRole("heading", { name: "Project not found" })).toBeVisible();

    expect((await scan(page)).violations).toEqual([]);
  });
});
