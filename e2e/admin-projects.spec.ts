import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ADMIN_STATE } from "./helpers/admin";
import { createProject, databaseConfigured, deleteProjects, query, type ThrowawayProject } from "./helpers/db";

// Needs the sample data (pnpm db:seed) and Supabase credentials. Every test that changes data
// creates its own throwaway project and removes it afterwards; the samples are only read.
// Tests that change data run in the desktop project only.

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

const rowFor = (page: Page, project: ThrowawayProject) => page.getByRole("row", { name: new RegExp(project.title) });
const publicStatus = async (page: Page, slug: string) => (await page.request.get(`/projects/${slug}`)).status();

let created: string[] = [];
test.beforeEach(() => {
  created = [];
});
test.afterEach(async () => {
  await deleteProjects(created);
});

async function newProject(options?: Parameters<typeof createProject>[0]) {
  const project = await createProject(options);
  created.push(project.id);
  return project;
}

test("lists drafts as well as the published sample projects, with their image counts", async ({ page }) => {
  const draft = await newProject();

  await page.goto("/admin/projects");

  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  const draftRow = rowFor(page, draft);
  await expect(draftRow.getByText("Draft", { exact: true })).toBeVisible();
  await expect(draftRow.getByText("1 image", { exact: true })).toBeVisible();
  const sample = page.getByRole("row", { name: /Harbour Light Library/ });
  await expect(sample.getByText("Published", { exact: true })).toBeVisible();
  await expect(sample.getByText("4 images", { exact: true })).toBeVisible();
});

test("refuses to publish a project that is not ready, and says what is missing", async ({ page, isMobile }) => {
  test.skip(isMobile, "changes data; the desktop project covers it");
  const unready = await newProject({ ready: false });
  await page.goto("/admin/projects");

  await page.getByRole("button", { name: `Publish ${unready.title}` }).click();

  const alert = page.getByRole("alert").filter({ hasText: "cannot be published yet" });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("Add at least one image.");
  await expect(alert).toBeFocused();
  await expect(rowFor(page, unready).getByText("Draft", { exact: true })).toBeVisible();
  expect(await publicStatus(page, unready.slug)).toBe(404);
});

test("publishing makes a project appear on the public site at once, and unpublishing removes it", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "changes data; the desktop project covers it");
  const project = await newProject();
  // Visit first so the "not found" answer is cached: publishing must expire it, not wait a day.
  expect(await publicStatus(page, project.slug)).toBe(404);
  await page.goto("/admin/projects");

  await page.getByRole("button", { name: `Publish ${project.title}` }).click();

  const status = page.getByRole("status").filter({ hasText: `"${project.title}" is now published.` });
  await expect(status).toBeVisible();
  await expect(status).toBeFocused();
  await expect(rowFor(page, project).getByText("Published", { exact: true })).toBeVisible();
  expect(await publicStatus(page, project.slug)).toBe(200);
  await page.goto(`/projects/${project.slug}`);
  await expect(page.getByRole("heading", { level: 1, name: project.title })).toBeVisible();
  expect(await (await page.request.get("/sitemap.xml")).text()).toContain(`/projects/${project.slug}`);

  await page.goto("/admin/projects");
  await page.getByRole("button", { name: `Unpublish ${project.title}` }).click();

  await expect(page.getByRole("status").filter({ hasText: "is now a draft" })).toBeVisible();
  await expect(rowFor(page, project).getByText("Draft", { exact: true })).toBeVisible();
  expect(await publicStatus(page, project.slug)).toBe(404);
  expect(await (await page.request.get("/sitemap.xml")).text()).not.toContain(project.slug);
});

test("featuring a project puts it on the home page at once, and un-featuring takes it off", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "changes data; the desktop project covers it");
  const project = await newProject({ status: "published" });
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Featured projects" }).getByRole("link", { name: project.title })).toHaveCount(0);
  await page.goto("/admin/projects");
  const toggle = page.getByRole("button", { name: `Featured: ${project.title}` });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await toggle.click();

  await expect(page.getByRole("status").filter({ hasText: "is featured on the home page" })).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Featured projects" }).getByRole("link", { name: project.title })).toBeVisible();

  await page.goto("/admin/projects");
  await page.getByRole("button", { name: `Featured: ${project.title}` }).click();
  await expect(page.getByRole("status").filter({ hasText: "is no longer featured" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Featured projects" }).getByRole("link", { name: project.title })).toHaveCount(0);
});

test("deleting asks first; Cancel keeps the project, confirming removes it everywhere", async ({ page, isMobile }) => {
  test.skip(isMobile, "changes data; the desktop project covers it");
  const project = await newProject({ status: "published" });
  expect(await publicStatus(page, project.slug)).toBe(200);
  await page.goto("/admin/projects");

  await page.getByRole("button", { name: `Delete ${project.title}` }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this project?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`"${project.title}" and its 1 image will be permanently removed`);
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(rowFor(page, project)).toBeVisible();

  await page.getByRole("button", { name: `Delete ${project.title}` }).click();
  await dialog.getByRole("button", { name: "Delete project" }).click();

  const status = page.getByRole("status").filter({ hasText: `"${project.title}" was deleted.` });
  await expect(status).toBeVisible();
  await expect(status).toBeFocused();
  await expect(rowFor(page, project)).toHaveCount(0);
  expect(await query("select 1 from projects where id = $1", [project.id])).toHaveLength(0);
  expect(await query("select 1 from project_images where project_id = $1", [project.id])).toHaveLength(0);
  expect(await publicStatus(page, project.slug)).toBe(404);
});

test("Escape closes the delete confirmation without deleting", async ({ page, isMobile }) => {
  test.skip(isMobile, "changes data; the desktop project covers it");
  const project = await newProject();
  await page.goto("/admin/projects");
  const deleteButton = page.getByRole("button", { name: `Delete ${project.title}` });

  await deleteButton.click();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(deleteButton).toBeFocused();
  await expect(rowFor(page, project)).toBeVisible();
});

test("keeps the page itself from scrolling sideways; the table scrolls inside its own box", async ({ page }) => {
  await page.goto("/admin/projects");
  await expect(page.getByRole("table")).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole("region", { name: "Projects" })).toHaveAttribute("tabindex", "0");
});

test("has no detectable accessibility violations, with the table and with the confirmation open", async ({ page }) => {
  const scan = () => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  await page.goto("/admin/projects");
  await expect(page.getByRole("table")).toBeVisible();
  expect((await scan()).violations).toEqual([]);

  await page.getByRole("button", { name: "Delete Harbour Light Library" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect((await scan()).violations).toEqual([]);
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the projects page and its actions are closed to visitors", async ({ request }) => {
    const page = await request.get("/admin/projects", { maxRedirects: 0 });
    expect(page.status()).toBe(307);

    // Server actions are POSTs to the page's own URL; the proxy turns them away too.
    const post = await request.post("/admin/projects", { maxRedirects: 0, data: "intent=delete" });
    expect(post.status()).toBe(307);
  });
});
