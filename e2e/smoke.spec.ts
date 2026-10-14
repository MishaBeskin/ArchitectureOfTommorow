import { expect, test } from "@playwright/test";

test("home page responds with a heading", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("unknown route returns 404", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist");

  expect(response?.status()).toBe(404);
});
