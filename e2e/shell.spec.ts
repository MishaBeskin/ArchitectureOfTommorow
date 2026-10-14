import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("skip link is the first tab stop and moves focus to main content", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("has no detectable accessibility violations", async ({ page }) => {
  await page.goto("/");

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();

  expect(results.violations).toEqual([]);
});

test("desktop nav navigates and marks the current page", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop navigation is hidden on small screens");
  await page.goto("/");

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Projects" }).click();

  await expect(page).toHaveURL("/projects");
  await expect(
    page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Projects" }),
  ).toHaveAttribute("aria-current", "page");
});

test("mobile menu opens, closes with Escape and returns focus to the trigger", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile menu is only shown on small screens");
  await page.goto("/");

  const trigger = page.getByRole("button", { name: "Menu" });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Main menu" })).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("mobile menu navigates and closes", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile menu is only shown on small screens");
  await page.goto("/");

  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Projects" }).click();

  await expect(page).toHaveURL("/projects");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("unknown route shows the not-found page with a way home", async ({ page }) => {
  const response = await page.goto("/nope");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
});
