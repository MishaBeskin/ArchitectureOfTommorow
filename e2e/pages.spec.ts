import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const { path, heading } of [
  { path: "/about", heading: "About" },
  { path: "/contact", heading: "Contact" },
]) {
  test(`${path} renders its heading and has no accessibility violations`, async ({ page }) => {
    await page.goto(path);

    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(results.violations).toEqual([]);
  });
}

test("contact form reports every missing field and moves focus to the summary", async ({ page }) => {
  await page.goto("/contact");

  await page.getByRole("button", { name: "Send message" }).click();

  // Next.js renders its own role="alert" route announcer, so match ours by its name.
  const summary = page.getByRole("alert", { name: /problems with your submission/ });
  await expect(summary).toBeFocused();
  await expect(summary.getByRole("link")).toHaveCount(3);
  await expect(page.getByLabel(/Name/)).toHaveAttribute("aria-invalid", "true");
});

test("contact form error link moves focus to the field", async ({ page }) => {
  await page.goto("/contact");
  await page.getByRole("button", { name: "Send message" }).click();

  await page.getByRole("link", { name: "Enter your name." }).click();

  await expect(page.getByLabel(/Name/)).toBeFocused();
});

test("contact page has accessibility-clean error state", async ({ page }) => {
  await page.goto("/contact");
  await page.getByRole("button", { name: "Send message" }).click();

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();

  expect(results.violations).toEqual([]);
});

test("document titles use the site template", async ({ page }) => {
  await page.goto("/about");

  await expect(page).toHaveTitle("About | Architecture of Tomorrow");
});
