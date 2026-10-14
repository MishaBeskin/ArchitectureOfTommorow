import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { ADMIN_STATE } from "./helpers/admin";
import { createProject, databaseConfigured, deleteProjects, query } from "./helpers/db";

// Creates and edits throwaway projects with random e2e- slugs and removes them afterwards.
// The seeded samples are never touched.

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

let slugs: string[] = [];
test.beforeEach(() => {
  slugs = [];
});
test.afterEach(async () => {
  const rows = await query<{ id: string }>("select id from projects where slug = any($1)", [slugs]);
  await deleteProjects(rows.map((row) => row.id));
});

test("creating a project saves a draft, opens its edit page and keeps it off the public site", async ({ page }) => {
  const tag = randomUUID().slice(0, 8);
  const title = `E2E Form ${tag}`;
  slugs.push(`e2e-form-${tag}`);

  await page.goto("/admin/projects/new");
  await page.getByLabel(/^Title/).fill(title);
  await expect(page.getByLabel(/^Web address/)).toHaveValue(`e2e-form-${tag}`);
  await page.getByLabel(/^Type/).selectOption("cultural");
  await page.getByLabel(/^City/).fill("Oslo");
  await page.getByLabel(/^Country/).selectOption("NO");
  await page.getByRole("button", { name: "Create project" }).click();

  await expect(page).toHaveURL(/\/admin\/projects\/[0-9a-f-]{36}\?created=1/);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText("The draft was created.")).toBeVisible();
  await expect(page.getByText("Before it can be published:")).toBeVisible();
  expect((await page.request.get(`/projects/e2e-form-${tag}`)).status()).toBe(404);
});

test("invalid input shows a summary of problems, keeps typed text and saves nothing", async ({ page }) => {
  await page.goto("/admin/projects/new");
  await page.getByLabel(/^Summary/).fill("Text that must survive");
  await page.getByRole("button", { name: "Create project" }).click();

  const summary = page.getByRole("alert").filter({ hasText: "problems with your submission" });
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
  await expect(summary.getByRole("link", { name: "Enter a title." })).toBeVisible();
  await expect(page.getByLabel(/^Summary/)).toHaveValue("Text that must survive");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("renaming the web address keeps the old address working as a redirect", async ({ page }) => {
  const project = await createProject({ status: "published" });
  slugs.push(project.slug, `${project.slug}-renamed`);

  await page.goto(`/admin/projects/${project.id}`);
  await page.getByLabel(/^Web address/).fill(`${project.slug}-renamed`);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "was saved." })).toBeVisible();

  const old = await page.request.get(`/projects/${project.slug}`, { maxRedirects: 0 });
  expect(old.status()).toBe(308);
  expect(old.headers().location).toContain(`/projects/${project.slug}-renamed`);
  expect((await page.request.get(`/projects/${project.slug}-renamed`)).status()).toBe(200);
});

test("a web address that another project uses is refused", async ({ page }) => {
  const other = await createProject({});
  const mine = await createProject({});
  slugs.push(other.slug, mine.slug);

  await page.goto(`/admin/projects/${mine.id}`);
  await page.getByLabel(/^Web address/).fill(other.slug);
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("link", { name: /Another project already uses/ })).toBeVisible();
});
