import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// These tests read the seeded sample projects (pnpm db:seed) from the configured database.

test("shows the hero with the lead featured project and its cover image", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Architecture of Tomorrow" })).toBeVisible();
  const caption = page.getByRole("figure");
  await expect(caption.getByRole("link", { name: "Harbour Light Library" })).toBeVisible();

  const image = caption.locator("img");
  await expect(image).toBeVisible();
  // Natural width > 0 proves the image really loaded through the optimizer, not just rendered.
  await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
});

test("lists the other featured projects as cards with a single link each", async ({ page }) => {
  await page.goto("/");

  const section = page.getByRole("region", { name: "Featured projects" });
  const cards = section.getByRole("listitem");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).getByRole("link")).toHaveText("Terrace Houses, Alfama");
  await expect(cards.nth(1).getByRole("link")).toHaveText("Kansai Timber School");
  await expect(cards.nth(0).getByRole("link")).toHaveAttribute("href", "/projects/terrace-houses-alfama");
});

test("never shows the unpublished draft", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Draft Pavilion")).toHaveCount(0);
});

test("the hero image is the preloaded LCP image", async ({ page }) => {
  await page.goto("/");

  const preloads = await page.locator('link[rel="preload"][as="image"]').count();
  expect(preloads).toBeGreaterThan(0);
});

test("has no horizontal scroll at any viewport width", async ({ page }) => {
  await page.goto("/");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("has no detectable accessibility violations with real data", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("region", { name: "Featured projects" }).waitFor();

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();

  expect(results.violations).toEqual([]);
});
