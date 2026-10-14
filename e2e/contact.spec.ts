import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

// Submits the real form to the real server and checks the database. The test server uses
// Cloudflare's documented dummy Turnstile keys (always pass), no email, and a high rate limit
// (see playwright.config.ts). Rows created here are removed afterwards.

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI supplies DATABASE_URL directly.
}

test.skip(!process.env.DATABASE_URL, "needs DATABASE_URL to check the stored messages");

// A fresh address per test: tests run in parallel, so a shared one would let one test's cleanup
// delete another test's row (or leave it looking for a row that is not its own).
let TEST_EMAIL = "";

test.beforeEach(() => {
  TEST_EMAIL = `e2e-${randomUUID()}@example.test`;
});

async function query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}

test.afterEach(async () => {
  await query("delete from contact_messages where email = $1", [TEST_EMAIL]);
  await query("delete from rate_limits where key like 'contact:ip:%'");
});

/** Types a valid message and waits for Turnstile to hand the form its token. */
async function fillForm(page: Page, message: string) {
  await page.goto("/contact");
  await page.getByLabel(/Name/).fill("E2E Tester");
  await page.getByLabel(/Email/).fill(TEST_EMAIL);
  await page.getByLabel(/Message/).fill(message);
  // The dummy site key solves itself; submitting before the token exists would be rejected.
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, { timeout: 20_000 });
  // The form also refuses submissions faster than a person could write them.
  await page.waitForTimeout(1_600);
}

test("a valid message is stored and the visitor sees a thank-you", async ({ page }) => {
  const message = `Automated end-to-end test message ${Date.now()}`;
  await fillForm(page, message);

  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByRole("status")).toContainText("your message is on its way");
  await expect(page.getByRole("button", { name: "Send message" })).toHaveCount(0);

  const rows = await query<{ name: string; message: string; ip_hash: string | null; handled_at: Date | null }>(
    "select name, message, ip_hash, handled_at from contact_messages where email = $1",
    [TEST_EMAIL],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ name: "E2E Tester", message, handled_at: null });
  // Only a hash of the visitor's address is kept.
  expect(rows[0]!.ip_hash).toMatch(/^[0-9a-f]{32}$/);
});

test("a bot that fills the hidden field sees success but nothing is stored", async ({ page }) => {
  await fillForm(page, "Spam message from a pretend bot, long enough.");
  await page.locator('input[name="website"]').evaluate((el: HTMLInputElement) => {
    el.value = "http://spam.example";
  });

  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByRole("status")).toContainText("your message is on its way");
  const rows = await query("select 1 from contact_messages where email = $1", [TEST_EMAIL]);
  expect(rows).toHaveLength(0);
});

test("the browser checks the form before the server is asked", async ({ page }) => {
  await page.goto("/contact");

  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByRole("alert", { name: /problems with your submission/ })).toBeFocused();
  const rows = await query("select 1 from contact_messages where email = $1", [TEST_EMAIL]);
  expect(rows).toHaveLength(0);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("says why the form cannot be used instead of failing silently", async ({ page }) => {
    await page.goto("/contact");

    await expect(page.locator("noscript p", { hasText: "needs JavaScript" })).toBeVisible();
  });
});
