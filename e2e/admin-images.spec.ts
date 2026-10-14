import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { ADMIN_STATE } from "./helpers/admin";
import { createProject, databaseConfigured, deleteProjects, query } from "./helpers/db";
import { listFolder, removeProjectFiles } from "./helpers/storage";

// Uploads real files to Supabase Storage for throwaway projects and removes projects, rows and
// files afterwards. The seeded samples are never touched.

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI supplies the variables directly.
}

test.skip(
  !(databaseConfigured && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY),
  "needs the database and Supabase credentials",
);

// An upload crosses storage, the server and a page refresh, so waits here are longer than the default.
const check = expect.configure({ timeout: 20_000 });
test.setTimeout(90_000);

let created: string[] = [];
test.beforeEach(() => {
  created = [];
});
test.afterEach(async () => {
  await removeProjectFiles(created);
  await deleteProjects(created);
});

async function draft() {
  // ready:false = a draft with a summary but no images, so the first upload is what makes it publishable.
  const project = await createProject({ ready: false });
  created.push(project.id);
  return project;
}

const jpeg = (width = 1200, height = 800, color = "#3a6ea5") =>
  sharp({ create: { width, height, channels: 3, background: color } }).jpeg().toBuffer();

/** The page also has the project form's own Description field, so the upload form is scoped by name. */
const uploadForm = (page: Page) => page.getByRole("form", { name: "Add an image" });

async function upload(
  page: Page,
  alt: string,
  buffer: Buffer,
  options: { name?: string; type?: string; credit?: string } = {},
) {
  const form = uploadForm(page);
  await form.getByLabel(/^Image file/).setInputFiles({
    name: options.name ?? "photo.jpg",
    mimeType: options.type ?? "image/jpeg",
    buffer,
  });
  await form.getByRole("textbox", { name: /^Description/ }).fill(alt);
  if (options.credit) await form.getByLabel(/^Credit/).fill(options.credit);
  await form.getByRole("button", { name: "Upload image" }).click();
}

test.describe("signed in", () => {
  test.use({ storageState: ADMIN_STATE });

  test("a real upload is re-encoded and stored, becomes the cover, makes the project publishable, and leaves nothing behind", async ({
    page,
  }) => {
    const project = await draft();
    await page.goto(`/admin/projects/${project.id}`);
    await check(page.getByText("Add at least one image.")).toBeVisible();

    await upload(page, "A blue test facade", await jpeg(4000, 2000), { credit: "Test Studio" });

    await check(page.getByRole("status").filter({ hasText: "The image was added." })).toBeVisible();
    await check(page.getByRole("heading", { name: "Images (1)" })).toBeVisible();
    await check(page.getByLabel(/^Image 1 description/)).toHaveValue("A blue test facade");
    await check(page.getByText("Cover image")).toBeVisible();
    await check(page.getByText("It is ready to publish.")).toBeVisible();

    const [row] = await query<{ pathname: string; url: string; width: number; height: number; credit: string }>(
      "select pathname, url, width, height, credit from project_images where project_id = $1",
      [project.id],
    );
    expect(row!.pathname).toMatch(new RegExp(`^projects/${project.id}/[0-9a-f-]{36}\\.webp$`));
    expect([row!.width, row!.height]).toEqual([2400, 1200]);
    expect(row!.credit).toBe("Test Studio");

    const served = await page.request.get(row!.url);
    expect(served.status()).toBe(200);
    expect(served.headers()["content-type"]).toBe("image/webp");
    expect(await listFolder(`tmp/${project.id}`)).toEqual([]);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("an uploaded project can be published and then shows its image on the public site", async ({ page }) => {
    const project = await draft();
    await page.goto(`/admin/projects/${project.id}`);
    await upload(page, "Public facade", await jpeg());
    await check(page.getByText("It is ready to publish.")).toBeVisible();

    await page.goto("/admin/projects");
    await page.getByRole("button", { name: `Publish ${project.title}` }).click();
    await check(page.getByRole("status").filter({ hasText: "is now published" })).toBeVisible();

    await page.goto(`/projects/${project.slug}`);
    await check(page.getByRole("img", { name: "Public facade" }).first()).toBeVisible();
  });

  test("a file that is not an image is refused, even when called a JPEG, and nothing is stored", async ({ page }) => {
    const project = await draft();
    await page.goto(`/admin/projects/${project.id}`);

    await upload(
      page,
      "Not really",
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      { name: "evil.jpg" },
    );

    await check(page.getByRole("alert").filter({ hasText: /Only JPEG|could not be read/ })).toBeVisible();
    expect(await query("select 1 from project_images where project_id = $1", [project.id])).toHaveLength(0);
    expect(await listFolder(`tmp/${project.id}`)).toEqual([]);
    expect(await listFolder(`projects/${project.id}`)).toEqual([]);
  });

  test("the browser refuses an unsupported type and a missing description before contacting the server", async ({
    page,
  }) => {
    const project = await draft();
    await page.goto(`/admin/projects/${project.id}`);

    await uploadForm(page).getByRole("button", { name: "Upload image" }).click();
    await check(uploadForm(page).getByRole("alert")).toContainText("Choose an image file first.");

    await upload(page, "", await jpeg());
    await check(uploadForm(page).getByRole("alert")).toContainText("Fix the problem below");
    await check(uploadForm(page).getByText("Describe the image for people who cannot see it.")).toBeVisible();

    await uploadForm(page)
      .getByLabel(/^Image file/)
      .setInputFiles({ name: "x.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
    await uploadForm(page).getByRole("textbox", { name: /^Description/ }).fill("A gif");
    await uploadForm(page).getByRole("button", { name: "Upload image" }).click();
    await check(uploadForm(page).getByRole("alert")).toContainText("Only JPEG, PNG, WebP and AVIF");
    expect(await listFolder(`tmp/${project.id}`)).toEqual([]);
  });

  test("details, order, cover and deletion work, and deleting removes the stored file", async ({ page }) => {
    const project = await draft();
    await page.goto(`/admin/projects/${project.id}`);
    await upload(page, "First", await jpeg(800, 500, "#aa3333"));
    await check(page.getByRole("heading", { name: "Images (1)" })).toBeVisible();
    await upload(page, "Second", await jpeg(800, 500, "#33aa33"));
    await check(page.getByRole("heading", { name: "Images (2)" })).toBeVisible();

    await page.getByRole("button", { name: "Move image 2 up" }).click();
    await check(page.getByLabel(/^Image 1 description/)).toHaveValue("Second");

    await page.getByRole("button", { name: "Make image 1 the cover" }).click();
    await check(page.getByRole("status").filter({ hasText: "now the cover" })).toBeVisible();
    const cover = await query<{ alt: string }>(
      "select i.alt from projects p join project_images i on i.id = p.cover_image_id where p.id = $1",
      [project.id],
    );
    expect(cover[0]!.alt).toBe("Second");

    await page.getByLabel(/^Image 2 description/).fill("First, renamed");
    await page.getByLabel("Image 2 caption").fill("A caption");
    await page.getByRole("button", { name: "Save details of image 2" }).click();
    await check(page.getByRole("status").filter({ hasText: "details were saved" })).toBeVisible();
    const saved = await query<{ alt: string; caption: string }>(
      "select alt, caption from project_images where project_id = $1 and alt = 'First, renamed'",
      [project.id],
    );
    expect(saved[0]!.caption).toBe("A caption");

    expect(await listFolder(`projects/${project.id}`)).toHaveLength(2);
    await page.getByRole("button", { name: "Delete image 2" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete image" }).click();
    await check(page.getByRole("heading", { name: "Images (1)" })).toBeVisible();
    expect(await listFolder(`projects/${project.id}`)).toHaveLength(1);
  });

  test("blank description cannot be saved on an existing image", async ({ page }) => {
    const project = await draft();
    await page.goto(`/admin/projects/${project.id}`);
    await upload(page, "Keep me", await jpeg(600, 400));
    await check(page.getByRole("heading", { name: "Images (1)" })).toBeVisible();

    await page.getByLabel(/^Image 1 description/).fill("");
    await page.getByRole("button", { name: "Save details of image 1" }).click();

    await check(page.getByRole("alert").filter({ hasText: "Fix the problem" })).toBeVisible();
    const rows = await query<{ alt: string }>("select alt from project_images where project_id = $1", [project.id]);
    expect(rows[0]!.alt).toBe("Keep me");
  });

  test("deleting a project removes its image files too", async ({ page }) => {
    const project = await draft();
    await page.goto(`/admin/projects/${project.id}`);
    await upload(page, "Doomed", await jpeg(600, 400));
    await check(page.getByRole("heading", { name: "Images (1)" })).toBeVisible();
    expect(await listFolder(`projects/${project.id}`)).toHaveLength(1);

    await page.goto("/admin/projects");
    await page.getByRole("button", { name: `Delete ${project.title}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete project" }).click();
    await check(page.getByRole("status").filter({ hasText: "was deleted" })).toBeVisible();

    expect(await listFolder(`projects/${project.id}`)).toEqual([]);
  });
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the upload route answers 401 and hands out nothing", async ({ request }) => {
    const response = await request.post("/api/admin/upload", {
      data: { projectId: "11111111-1111-4111-8111-111111111111", contentType: "image/jpeg", size: 1000 },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Not signed in." });
  });
});
