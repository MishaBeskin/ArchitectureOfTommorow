import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { ADMIN_STATE } from "./helpers/admin";
import { databaseConfigured, query } from "./helpers/db";

// Inserts throwaway messages with a random tag in the name and removes them afterwards. Any real
// messages in the inbox are left alone.

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI supplies the variables directly.
}

test.skip(
  !(databaseConfigured && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY),
  "needs the database and Supabase credentials",
);

test.use({ storageState: ADMIN_STATE });

let tag = "";
test.beforeEach(() => {
  tag = randomUUID().slice(0, 8);
});
test.afterEach(async () => {
  await query("delete from contact_messages where name like $1", [`E2E ${tag}%`]);
  await query("delete from rate_limits where key like 'contact:ip:%'");
});

async function addMessage(suffix: string, text: string, email = "visitor@example.com") {
  const name = `E2E ${tag} ${suffix}`;
  await query("insert into contact_messages (name, email, message) values ($1, $2, $3)", [name, email, text]);
  return name;
}

const card = (page: Page, name: string) => page.getByRole("article", { name: `Message from ${name}` });

test("a message sent through the real contact form appears in the inbox", async ({ page }) => {
  const name = `E2E ${tag} Form`;
  await page.goto("/contact");
  await page.getByLabel(/Name/).fill(name);
  await page.getByLabel(/Email/).fill("form@example.com");
  await page.getByLabel(/Message/).fill("Sent through the real form.");
  // The dummy site key solves itself; the form also refuses submissions faster than a person could write.
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, { timeout: 20_000 });
  await page.waitForTimeout(1_600);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toContainText("your message is on its way");

  await page.goto("/admin/messages");

  await expect(card(page, name)).toContainText("Sent through the real form.");
  await expect(card(page, name).getByText("New", { exact: true })).toBeVisible();
});

test("messages can be marked handled and new again, and are shown as plain text", async ({ page }) => {
  const markup = await addMessage("Markup", '<img src=x onerror="window.__pwned=1"><b>not bold</b>\nsecond line');
  await page.goto("/admin/messages");

  await expect(card(page, markup)).toContainText('<img src=x onerror="window.__pwned=1"><b>not bold</b>');
  await expect(card(page, markup).locator("b, img")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();

  await card(page, markup).getByRole("button", { name: /as handled/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "marked as handled" })).toBeVisible();
  await expect(card(page, markup).getByText("Handled", { exact: true })).toBeVisible();
  const [row] = await query<{ handled_at: Date | null }>("select handled_at from contact_messages where name = $1", [
    markup,
  ]);
  expect(row!.handled_at).not.toBeNull();

  await card(page, markup).getByRole("button", { name: /as new/ }).click();
  await expect(card(page, markup).getByText("New", { exact: true })).toBeVisible();
});

test("a message can be deleted after confirming, and Cancel keeps it", async ({ page }) => {
  const name = await addMessage("Delete", "Please delete me.");
  await page.goto("/admin/messages");

  await page.getByRole("button", { name: `Delete the message from ${name}` }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this message?" });
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(card(page, name)).toBeVisible();

  await page.getByRole("button", { name: `Delete the message from ${name}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete message" }).click();

  await expect(page.getByRole("status").filter({ hasText: "was deleted" })).toBeVisible();
  await expect(card(page, name)).toHaveCount(0);
  expect(await query("select 1 from contact_messages where name = $1", [name])).toHaveLength(0);
});

test("the inbox has no detectable accessibility violations", async ({ page }) => {
  await addMessage("A11y", "Checking the page.");
  await page.goto("/admin/messages");
  await expect(page.getByRole("heading", { level: 1, name: "Messages" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the inbox is closed: visitors are sent to the sign-in page", async ({ page }) => {
    await page.goto("/admin/messages");

    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fmessages/);
  });
});
