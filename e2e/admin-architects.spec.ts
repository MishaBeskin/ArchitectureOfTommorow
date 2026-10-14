import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { ADMIN_STATE } from "./helpers/admin";
import { databaseConfigured, query } from "./helpers/db";

// Adds, edits and deletes throwaway architects with random e2e- names and removes them afterwards.
// The seeded architects are never touched.

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

let tags: string[] = [];
test.beforeEach(() => {
  tags = [];
});
test.afterEach(async () => {
  // Projects first (their credits go with them): a credited architect cannot be deleted.
  for (const tag of tags) {
    await query("delete from projects where slug like $1", [`e2e-arch-${tag}%`]);
    await query("delete from architects where slug like $1", [`e2e-arch-${tag}%`]);
  }
});

function newTag() {
  const tag = randomUUID().slice(0, 8);
  tags.push(tag);
  return tag;
}

test("adds an architect, edits it, and deletes it", async ({ page }) => {
  const tag = newTag();
  const name = `E2E Arch ${tag}`;

  await page.goto("/admin/architects/new");
  await page.getByLabel(/^Name/).fill(name);
  await expect(page.getByLabel(/^Web address/)).toHaveValue(`e2e-arch-${tag}`);
  await page.getByLabel(/^Website/).fill("https://example.com");
  await page.getByRole("button", { name: "Add architect" }).click();

  await expect(page).toHaveURL(/\/admin\/architects\/[0-9a-f-]{36}\?created=1/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

  await page.getByLabel(/^Biography/).fill("Added by the end-to-end tests.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "was saved." })).toBeVisible();

  await page.goto("/admin/architects");
  await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText("example.com");

  await page.getByRole("button", { name: `Delete ${name}` }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this architect?" });
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await dialog.getByRole("button", { name: "Delete architect" }).click();

  await expect(page.getByRole("status").filter({ hasText: "was deleted." })).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(name) })).toHaveCount(0);
});

test("rejects an unsafe website address with a clear message", async ({ page }) => {
  await page.goto("/admin/architects/new");
  await page.getByLabel(/^Name/).fill("E2E Unsafe");
  await page.getByLabel(/^Website/).fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Add architect" }).click();

  const summary = page.getByRole("alert").filter({ hasText: "problem" });
  await expect(summary.getByRole("link", { name: /full website address/ })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("an architect who is credited on a project cannot be deleted", async ({ page }) => {
  const tag = newTag();
  const name = `E2E Credited ${tag}`;
  const [architect] = await query<{ id: string }>(
    "insert into architects (slug, name) values ($1, $2) returning id",
    [`e2e-arch-${tag}`, name],
  );
  const [project] = await query<{ id: string }>(
    `insert into projects (slug, title, summary, type, year, city, country_code)
     values ($1, $2, 'x', 'civic', 2024, 'Oslo', 'NO') returning id`,
    [`e2e-arch-${tag}-project`, `E2E Project ${tag}`],
  );
  await query("insert into project_architects (project_id, architect_id) values ($1, $2)", [project!.id, architect!.id]);

  await page.goto("/admin/architects");
  await page.getByRole("button", { name: `Delete ${name}` }).click();
  await expect(page.getByRole("dialog")).toContainText("credited on 1 project");
  await page.getByRole("dialog").getByRole("button", { name: "Delete architect" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "not deleted" })).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(name) })).toHaveCount(1);
});
