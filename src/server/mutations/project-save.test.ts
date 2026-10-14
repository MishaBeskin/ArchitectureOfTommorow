// @vitest-environment node
import { asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ProjectInput } from "@/lib/project-schema";
import { createTestDb, projectValues, type TestDb } from "@/test/db";
import { architects, projectArchitects, projectImages, projects, projectSlugRedirects } from "../db/schema";
import { createProject, updateProject } from "./project-save";

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

function input(overrides: Partial<ProjectInput> = {}): ProjectInput {
  return {
    title: "New Pavilion",
    slug: "new-pavilion",
    summary: "A pavilion.",
    descriptionMd: "Text.",
    type: "cultural",
    phase: "concept",
    year: 2026,
    city: "Oslo",
    region: null,
    countryCode: "NO",
    lat: null,
    lng: null,
    seoTitle: null,
    seoDescription: null,
    architects: [],
    ...overrides,
  };
}

async function makeArchitect(name: string) {
  const [row] = await db.insert(architects).values({ slug: name.toLowerCase().replace(/\W+/g, "-"), name }).returning();
  return row!;
}

/** A published project that passes every publish rule. */
async function makePublished(slug: string) {
  const [project] = await db
    .insert(projects)
    .values(projectValues({ slug, title: `Title ${slug}`, summary: "Ready.", status: "published" }))
    .returning();
  const [image] = await db
    .insert(projectImages)
    .values({
      projectId: project!.id,
      url: `https://storage.test/${slug}.webp`,
      pathname: `projects/${slug}.webp`,
      width: 1600,
      height: 1000,
      alt: "An image",
      blurDataUrl: "data:image/webp;base64,AAAA",
    })
    .returning();
  await db.update(projects).set({ coverImageId: image!.id }).where(eq(projects.id, project!.id));
  return project!;
}

const reload = async (id: string) => (await db.select().from(projects).where(eq(projects.id, id)))[0]!;
const redirects = async () => (await db.select().from(projectSlugRedirects)).map((r) => r.oldSlug).sort();

describe("createProject", () => {
  it("creates a draft with every field saved", async () => {
    const result = await createProject(
      db,
      input({ region: "Viken", lat: 59.9, lng: 10.7, seoTitle: "Seo", seoDescription: "Seo desc" }),
    );

    expect(result).toMatchObject({ ok: true, slug: "new-pavilion", status: "draft" });
    if (!result.ok) return;
    const row = await reload(result.id);
    expect(row).toMatchObject({
      title: "New Pavilion",
      status: "draft",
      featured: false,
      publishedAt: null,
      coverImageId: null,
      region: "Viken",
      lat: 59.9,
      lng: 10.7,
      seoTitle: "Seo",
      countryCode: "NO",
      year: 2026,
    });
  });

  it("saves the credits in the order given, with their roles", async () => {
    const [a, b] = [await makeArchitect("Ada"), await makeArchitect("Ben")];

    const result = await createProject(
      db,
      input({
        architects: [
          { architectId: b.id, role: "Lead" },
          { architectId: a.id, role: null },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const credits = await db
      .select()
      .from(projectArchitects)
      .where(eq(projectArchitects.projectId, result.id))
      .orderBy(asc(projectArchitects.sortOrder));
    expect(credits.map((c) => [c.architectId, c.role, c.sortOrder])).toEqual([
      [b.id, "Lead", 0],
      [a.id, null, 1],
    ]);
  });

  it("refuses a slug that another project uses, and creates nothing", async () => {
    await makePublished("new-pavilion");

    expect(await createProject(db, input())).toEqual({ ok: false, reason: "slug-taken" });
    expect(await db.select().from(projects)).toHaveLength(1);
  });

  it("refuses a slug that another project used before, since its old address redirects", async () => {
    const other = await makePublished("current-name");
    await db.insert(projectSlugRedirects).values({ oldSlug: "new-pavilion", projectId: other.id });

    expect(await createProject(db, input())).toEqual({ ok: false, reason: "slug-taken" });
  });

  it("refuses an architect that does not exist, and creates nothing", async () => {
    const result = await createProject(db, input({ architects: [{ architectId: randomUUID(), role: null }] }));

    expect(result).toEqual({ ok: false, reason: "unknown-architect" });
    expect(await db.select().from(projects)).toHaveLength(0);
  });
});

describe("updateProject", () => {
  it("saves the edits and keeps status, featured flag and cover untouched", async () => {
    const project = await makePublished("old-name");
    await db.update(projects).set({ featured: true, featuredOrder: 3 }).where(eq(projects.id, project.id));
    const before = await reload(project.id);

    const result = await updateProject(db, project.id, input({ slug: "old-name", title: "Edited", city: "Bergen" }));

    expect(result).toMatchObject({ ok: true, slug: "old-name", previousSlug: "old-name", status: "published" });
    const row = await reload(project.id);
    expect(row).toMatchObject({ title: "Edited", city: "Bergen", status: "published", featured: true, featuredOrder: 3 });
    expect(row.coverImageId).not.toBeNull();
    expect(row.coverImageId).toBe(before.coverImageId);
    expect(await redirects()).toEqual([]);
  });

  it("leaves a redirect from the old slug when the slug changes", async () => {
    const project = await makePublished("old-name");

    const result = await updateProject(db, project.id, input({ slug: "new-name" }));

    expect(result).toMatchObject({ ok: true, slug: "new-name", previousSlug: "old-name" });
    expect((await reload(project.id)).slug).toBe("new-name");
    expect(await redirects()).toEqual(["old-name"]);
  });

  it("keeps every earlier address when renamed more than once", async () => {
    const project = await makePublished("one");

    await updateProject(db, project.id, input({ slug: "two" }));
    await updateProject(db, project.id, input({ slug: "three" }));

    expect(await redirects()).toEqual(["one", "two"]);
  });

  it("removes the redirect when renamed back, so no address redirects to itself", async () => {
    const project = await makePublished("one");
    await updateProject(db, project.id, input({ slug: "two" }));

    await updateProject(db, project.id, input({ slug: "one" }));

    expect((await reload(project.id)).slug).toBe("one");
    expect(await redirects()).toEqual(["two"]);
  });

  it("refuses a slug used by another project or in another project's redirects, and changes nothing", async () => {
    const project = await makePublished("mine");
    const other = await makePublished("other");
    await db.insert(projectSlugRedirects).values({ oldSlug: "retired", projectId: other.id });

    expect(await updateProject(db, project.id, input({ slug: "other" }))).toEqual({ ok: false, reason: "slug-taken" });
    expect(await updateProject(db, project.id, input({ slug: "retired" }))).toEqual({
      ok: false,
      reason: "slug-taken",
    });
    expect((await reload(project.id)).slug).toBe("mine");
    expect(await redirects()).toEqual(["retired"]);
  });

  it("replaces the credits", async () => {
    const [a, b] = [await makeArchitect("Ada"), await makeArchitect("Ben")];
    const project = await makePublished("credited");
    await updateProject(db, project.id, input({ slug: "credited", architects: [{ architectId: a.id, role: "Lead" }] }));

    await updateProject(db, project.id, input({ slug: "credited", architects: [{ architectId: b.id, role: null }] }));

    const credits = await db.select().from(projectArchitects).where(eq(projectArchitects.projectId, project.id));
    expect(credits.map((c) => c.architectId)).toEqual([b.id]);
  });

  it("refuses to blank the summary of a published project, but allows it on a draft", async () => {
    const published = await makePublished("live");
    const [draft] = await db.insert(projects).values(projectValues({ slug: "wip", summary: "x" })).returning();

    const refused = await updateProject(db, published.id, input({ slug: "live", summary: "" }));
    const allowed = await updateProject(db, draft!.id, input({ slug: "wip", summary: "" }));

    expect(refused).toMatchObject({ ok: false, reason: "not-ready" });
    expect((await reload(published.id)).summary).toBe("Ready.");
    expect(allowed).toMatchObject({ ok: true });
  });

  it("reports a missing project, and an unknown architect without changing anything", async () => {
    const project = await makePublished("exists");

    expect(await updateProject(db, randomUUID(), input())).toEqual({ ok: false, reason: "not-found" });
    expect(
      await updateProject(
        db,
        project.id,
        input({ slug: "exists", title: "Nope", architects: [{ architectId: randomUUID(), role: null }] }),
      ),
    ).toEqual({ ok: false, reason: "unknown-architect" });
    expect((await reload(project.id)).title).toBe("Title exists");
  });
});
