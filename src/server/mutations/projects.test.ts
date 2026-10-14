// @vitest-environment node
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, projectValues, type TestDb } from "@/test/db";
import {
  architects,
  projectArchitects,
  projectImages,
  projects,
  projectSlugRedirects,
} from "../db/schema";
import { deleteProject, setProjectFeatured, setProjectStatus } from "./projects";

let db: TestDb;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.delete(projects); // cascades to images, credits and redirects
  await db.delete(architects);
});

/** A project that passes every publish rule unless overridden. */
async function makeProject(
  slug: string,
  opts: { summary?: string; images?: Array<{ alt: string }>; cover?: boolean; status?: "draft" | "published" } = {},
) {
  const [project] = await db
    .insert(projects)
    .values(projectValues({ slug, title: `Title ${slug}`, summary: opts.summary ?? "A summary.", status: opts.status }))
    .returning();
  const images = opts.images ?? [{ alt: "An image" }];
  const created = [];
  for (const [index, image] of images.entries()) {
    const [row] = await db
      .insert(projectImages)
      .values({
        projectId: project!.id,
        url: `https://storage.test/${slug}/${index}.webp`,
        pathname: `projects/${slug}/${index}.webp`,
        width: 1600,
        height: 1000,
        alt: image.alt,
        blurDataUrl: "data:image/webp;base64,AAAA",
        sortOrder: index,
      })
      .returning();
    created.push(row!);
  }
  if ((opts.cover ?? true) && created[0]) {
    await db.update(projects).set({ coverImageId: created[0].id }).where(eq(projects.id, project!.id));
  }
  return project!;
}

const reload = async (id: string) => (await db.select().from(projects).where(eq(projects.id, id)))[0]!;

describe("setProjectStatus: publishing", () => {
  it("publishes a ready project and stamps the first publication date", async () => {
    const project = await makeProject("ready");

    const result = await setProjectStatus(db, project.id, "published");

    expect(result).toMatchObject({ ok: true, slug: "ready", title: "Title ready", status: "published" });
    const after = await reload(project.id);
    expect(after.status).toBe("published");
    expect(after.publishedAt).toBeInstanceOf(Date);
  });

  it("keeps the original publication date when unpublished and published again", async () => {
    const project = await makeProject("again");
    await setProjectStatus(db, project.id, "published");
    const first = (await reload(project.id)).publishedAt!;
    await db.update(projects).set({ publishedAt: new Date("2020-01-01T00:00:00Z") }).where(eq(projects.id, project.id));

    await setProjectStatus(db, project.id, "draft");
    await setProjectStatus(db, project.id, "published");

    const after = await reload(project.id);
    expect(after.publishedAt!.toISOString()).toBe("2020-01-01T00:00:00.000Z");
    expect(after.publishedAt!.getTime()).not.toBe(first.getTime());
  });

  it.each<[string, Parameters<typeof makeProject>[1], string]>([
    ["has no images", { images: [] }, "Add at least one image."],
    ["has a blank summary", { summary: "   " }, "Add a summary."],
    ["has no cover chosen", { cover: false }, "Choose a cover image."],
    ["has an image without alt text", { images: [{ alt: "" }] }, "One image is missing its alt text."],
  ])("refuses a project that %s, and leaves it a draft", async (_name, opts, problem) => {
    const project = await makeProject(`blocked-${randomUUID().slice(0, 8)}`, opts);

    const result = await setProjectStatus(db, project.id, "published");

    expect(result).toMatchObject({ ok: false, reason: "not-ready", title: project.title });
    expect((result as { problems: string[] }).problems).toContain(problem);
    expect((await reload(project.id)).status).toBe("draft");
    expect((await reload(project.id)).publishedAt).toBeNull();
  });

  it("reports every problem at once", async () => {
    const project = await makeProject("many", { summary: "", images: [{ alt: "" }], cover: false });

    const result = await setProjectStatus(db, project.id, "published");

    expect((result as { problems: string[] }).problems).toEqual([
      "Add a summary.",
      "Choose a cover image.",
      "One image is missing its alt text.",
    ]);
  });

  it("returns not-found for an unknown project", async () => {
    expect(await setProjectStatus(db, randomUUID(), "published")).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("setProjectStatus: unpublishing", () => {
  it("always works, even when the project would not pass the publish rules today", async () => {
    const project = await makeProject("live", { status: "published", images: [], cover: false, summary: "" });

    const result = await setProjectStatus(db, project.id, "draft");

    expect(result).toMatchObject({ ok: true, status: "draft" });
    expect((await reload(project.id)).status).toBe("draft");
  });
});

describe("setProjectFeatured", () => {
  it("puts each newly featured project at the end of the featured order", async () => {
    const [a, b, c] = [await makeProject("fa"), await makeProject("fb"), await makeProject("fc")];

    await setProjectFeatured(db, b.id, true);
    await setProjectFeatured(db, a.id, true);
    await setProjectFeatured(db, c.id, true);

    expect([(await reload(b.id)).featuredOrder, (await reload(a.id)).featuredOrder, (await reload(c.id)).featuredOrder]).toEqual([1, 2, 3]);
  });

  it("clears the place when un-featuring, and re-featuring goes to the end", async () => {
    const [a, b] = [await makeProject("ua"), await makeProject("ub")];
    await setProjectFeatured(db, a.id, true);
    await setProjectFeatured(db, b.id, true);

    await setProjectFeatured(db, a.id, false);
    expect(await reload(a.id)).toMatchObject({ featured: false, featuredOrder: null });

    await setProjectFeatured(db, a.id, true);
    expect((await reload(a.id)).featuredOrder).toBe(3);
  });

  it("keeps the place when a project that is already featured is featured again", async () => {
    const [a, b] = [await makeProject("ka"), await makeProject("kb")];
    await setProjectFeatured(db, a.id, true);
    await setProjectFeatured(db, b.id, true);

    await setProjectFeatured(db, a.id, true);

    expect((await reload(a.id)).featuredOrder).toBe(1);
  });

  it("reports the title, slug and status so the caller can word its message and expire the cache", async () => {
    const draft = await makeProject("fd");

    expect(await setProjectFeatured(db, draft.id, true)).toEqual({
      ok: true,
      title: "Title fd",
      slug: "fd",
      featured: true,
      status: "draft",
    });
  });

  it("returns not-found for an unknown project", async () => {
    expect(await setProjectFeatured(db, randomUUID(), true)).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("deleteProject", () => {
  it("removes the project with its images, credits and slug redirects, and returns the file paths", async () => {
    const project = await makeProject("doomed", { images: [{ alt: "a" }, { alt: "b" }] });
    const [architect] = await db.insert(architects).values({ slug: "arch", name: "Arch" }).returning();
    await db.insert(projectArchitects).values({ projectId: project.id, architectId: architect!.id });
    await db.insert(projectSlugRedirects).values({ oldSlug: "old-doomed", projectId: project.id });

    const result = await deleteProject(db, project.id);

    expect(result).toMatchObject({ ok: true, slug: "doomed", title: "Title doomed" });
    expect((result as { pathnames: string[] }).pathnames.sort()).toEqual([
      "projects/doomed/0.webp",
      "projects/doomed/1.webp",
    ]);
    expect(await db.select().from(projects)).toHaveLength(0);
    expect(await db.select().from(projectImages)).toHaveLength(0);
    expect(await db.select().from(projectArchitects)).toHaveLength(0);
    expect(await db.select().from(projectSlugRedirects)).toHaveLength(0);
    expect(await db.select().from(architects)).toHaveLength(1); // the architect survives
  });

  it("leaves other projects alone", async () => {
    const keep = await makeProject("keep");
    const gone = await makeProject("gone");

    await deleteProject(db, gone.id);

    expect((await db.select().from(projects)).map((p) => p.id)).toEqual([keep.id]);
    expect(await db.select().from(projectImages)).toHaveLength(1);
  });

  it("returns not-found for an unknown project", async () => {
    expect(await deleteProject(db, randomUUID())).toEqual({ ok: false, reason: "not-found" });
  });
});
