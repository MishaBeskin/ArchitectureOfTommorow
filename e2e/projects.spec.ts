import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// These tests read the seeded sample projects (pnpm db:seed): 8 published, 1 draft.

const cards = (page: Page) => page.getByRole("list").filter({ has: page.getByRole("article") }).getByRole("listitem");
const apply = (page: Page) => page.getByRole("button", { name: "Apply filters" });

test("lists every published project, newest year first, and hides the draft", async ({ page }) => {
  await page.goto("/projects");

  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  await expect(page.getByText("8 projects", { exact: true })).toBeVisible();
  await expect(cards(page)).toHaveCount(8);
  await expect(cards(page).first().getByRole("link")).toHaveText("Yarra Market Quarter");
  await expect(cards(page).first().getByRole("link")).toHaveAttribute("href", "/projects/yarra-market-quarter");
  await expect(page.getByText("Draft Pavilion")).toHaveCount(0);
});

test("offers only options that exist in published projects, with counts", async ({ page }) => {
  await page.goto("/projects");

  await expect(page.getByLabel("Location").getByRole("option", { name: "Denmark (1)" })).toHaveCount(1);
  // The only commercial project is the unpublished draft, so that type is not offered.
  await expect(page.getByLabel("Type").getByRole("option", { name: "Commercial" })).toHaveCount(0);
});

test("filtering updates the URL to a clean canonical form and the results", async ({ page }) => {
  await page.goto("/projects");

  await page.getByLabel("Type").selectOption("education");
  await apply(page).click();

  // The empty location/year params a plain form sends are redirected away.
  await expect(page).toHaveURL(/\/projects\?type=education$/);
  await expect(page.getByText("1 project", { exact: true })).toBeVisible();
  await expect(cards(page).first().getByRole("link")).toHaveText("Kansai Timber School");
  await expect(page.getByLabel("Type")).toHaveValue("education");
});

test("combines filters and clears them", async ({ page }) => {
  await page.goto("/projects");
  await page.getByLabel("Location").selectOption("DK");
  await page.getByLabel("Type").selectOption("cultural");
  await apply(page).click();

  await expect(page).toHaveURL(/\/projects\?type=cultural&location=DK$/);
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first().getByRole("link")).toHaveText("Harbour Light Library");

  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(cards(page)).toHaveCount(8);
  await expect(page.getByLabel("Type")).toHaveValue("");
});

test("a filtered URL is shareable: opening it directly gives the same results", async ({ page }) => {
  await page.goto("/projects?location=DK");

  await expect(page.getByLabel("Location")).toHaveValue("DK");
  await expect(cards(page)).toHaveCount(1);
});

test("shows a helpful empty state when nothing matches", async ({ page }) => {
  await page.goto("/projects?type=civic&year=2021");

  await expect(page.getByRole("heading", { name: "No projects match these filters" })).toBeVisible();
  await expect(page.getByText("0 projects", { exact: true })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Clear filters" }).first().click();
  await expect(page).toHaveURL(/\/projects$/);
});

test("the draft is unreachable even through the only filter that matches it", async ({ page }) => {
  await page.goto("/projects?type=commercial");

  await expect(page.getByRole("heading", { name: "No projects match these filters" })).toBeVisible();
  await expect(page.getByText("Draft Pavilion")).toHaveCount(0);
});

test.describe("URL normalisation", () => {
  test("drops invalid values and redirects to the clean URL", async ({ page }) => {
    await page.goto("/projects?type=castle&year=abc");

    await expect(page).toHaveURL(/\/projects$/);
    await expect(cards(page)).toHaveCount(8);
  });

  test("removes an explicit page=1", async ({ page }) => {
    await page.goto("/projects?page=1");

    await expect(page).toHaveURL(/\/projects$/);
  });

  test("sends a page past the end to the last real page", async ({ page }) => {
    await page.goto("/projects?page=99");

    await expect(page).toHaveURL(/\/projects$/);
    await expect(cards(page)).toHaveCount(8);
  });

  test("upper-cases the country code and keeps unrelated params", async ({ page }) => {
    await page.goto("/projects?location=dk&utm_source=newsletter");

    await expect(page).toHaveURL(/\/projects\?utm_source=newsletter&location=DK$/);
    await expect(page.getByLabel("Location")).toHaveValue("DK");
  });
});

test("filtered views are noindex and the plain list is indexable", async ({ page }) => {
  await page.goto("/projects?type=civic");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  await page.goto("/projects");
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
});

test("has no pagination while everything fits on one page", async ({ page }) => {
  await page.goto("/projects");

  await expect(page.getByRole("navigation", { name: "Pagination" })).toHaveCount(0);
});

test("the filter form is keyboard operable", async ({ page }) => {
  await page.goto("/projects");

  await page.getByLabel("Type").focus();
  await page.keyboard.press("ArrowDown"); // moves to the first real type without submitting
  await expect(page).toHaveURL(/\/projects$/);
  await page.getByLabel("Type").selectOption("civic");
  await apply(page).focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/projects\?type=civic$/);
});

test("has no horizontal scroll", async ({ page }) => {
  await page.goto("/projects");
  await expect(cards(page)).toHaveCount(8);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

for (const path of ["/projects", "/projects?type=civic&year=2026", "/projects?type=civic&year=2021"]) {
  test(`has no detectable accessibility violations at ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.getByRole("form", { name: "Filter projects" }).waitFor();

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();

    expect(results.violations).toEqual([]);
  });
}

// Request-time data streams in behind Suspense and React reveals it with a script, so without
// JavaScript the list cannot be shown. These tests pin down that it degrades honestly rather than
// leaving a skeleton pulsing forever, and that crawlers still get every project in the HTML.
test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("explains that JavaScript is needed and hides the loading skeleton", async ({ page }) => {
    await page.goto("/projects");

    // Playwright's text matching skips <noscript> content, so address it by CSS.
    await expect(page.locator("noscript p", { hasText: "needs JavaScript" })).toBeVisible();
    await expect(page.locator("[data-projects-skeleton]")).toBeHidden();
  });
});

test("the server HTML already contains every published project for crawlers", async ({ request }) => {
  const html = await (await request.get("/projects")).text();

  for (const title of ["Harbour Light Library", "Terrace Houses, Alfama", "Kansai Timber School", "Delta Flood Park"]) {
    expect(html).toContain(title);
  }
  expect(html).not.toContain("Draft Pavilion");
  expect(html).toContain('href="/projects/yarra-market-quarter"');
});

test("a filtered request's HTML contains only the matching projects", async ({ request }) => {
  const html = await (await request.get("/projects?type=education")).text();

  expect(html).toContain("Kansai Timber School");
  expect(html).not.toContain("Harbour Light Library");
});
