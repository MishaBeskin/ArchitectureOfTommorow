// @vitest-environment node
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, projectValues, type TestDb } from "@/test/db";
import { architects, projectArchitects, projectImages, projects, projectSlugRedirects } from "../db/schema";
import { SEED_ARCHITECTS, SEED_PREFIX, SEED_PROJECTS } from "./data";
import { seedDatabase, unseedDatabase } from "./seed";

let db: TestDb;
let close: () => Promise<void>;
const uploaded = new Map<string, number>();

/** Fake storage: records uploads and hands back a predictable URL. */
const upload = async (pathname: string, data: Buffer) => {
  uploaded.set(pathname, data.length);
  return `https://storage.test/${pathname}`;
};

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

const totalImages = SEED_PROJECTS.reduce((sum, p) => sum + p.imageCount, 0);

describe("seedDatabase", () => {
  it("creates every project, image and credit and uploads each file", async () => {
    const summary = await seedDatabase(db, upload);

    expect(summary).toEqual({ projects: SEED_PROJECTS.length, images: totalImages });
    expect(await db.select().from(projects)).toHaveLength(SEED_PROJECTS.length);
    expect(await db.select().from(projectImages)).toHaveLength(totalImages);
    expect(await db.select().from(architects)).toHaveLength(SEED_ARCHITECTS.length);
    expect(uploaded.size).toBe(totalImages);
    expect([...uploaded.keys()].every((k) => k.startsWith(`${SEED_PREFIX}/`))).toBe(true);
  });

  it("sets the first image as cover and keeps images in order", async () => {
    const [project] = await db.select().from(projects).where(eq(projects.slug, "harbour-light-library"));
    const images = await db
      .select()
      .from(projectImages)
      .where(eq(projectImages.projectId, project!.id))
      .orderBy(asc(projectImages.sortOrder));

    expect(images.map((i) => i.sortOrder)).toEqual([0, 1, 2, 3]);
    expect(project!.coverImageId).toBe(images[0]!.id);
    expect(images.every((i) => i.alt.length > 0 && i.url.startsWith("https://storage.test/"))).toBe(true);
  });

  it("publishes everything except the draft and stamps publishedAt only on published rows", async () => {
    const rows = await db.select().from(projects);

    for (const row of rows) {
      expect(row.status === "published").toBe(row.publishedAt !== null);
    }
    expect(rows.filter((r) => r.status === "draft").map((r) => r.slug)).toEqual(["unpublished-draft-pavilion"]);
  });

  it("orders featured projects 1..3", async () => {
    const featured = await db
      .select({ slug: projects.slug, order: projects.featuredOrder })
      .from(projects)
      .where(eq(projects.featured, true))
      .orderBy(asc(projects.featuredOrder));

    expect(featured.map((f) => f.order)).toEqual([1, 2, 3]);
  });

  it("keeps credit order and roles", async () => {
    const [project] = await db.select().from(projects).where(eq(projects.slug, "terrace-houses-alfama"));
    const credits = await db
      .select({ role: projectArchitects.role, order: projectArchitects.sortOrder, name: architects.name })
      .from(projectArchitects)
      .innerJoin(architects, eq(architects.id, projectArchitects.architectId))
      .where(eq(projectArchitects.projectId, project!.id))
      .orderBy(asc(projectArchitects.sortOrder));

    expect(credits).toEqual([
      { role: "Lead architect", order: 0, name: "Atelier Vento" },
      { role: "Landscape", order: 1, name: "Casa Aurora" },
    ]);
  });

  it("creates a redirect row for each previous slug", async () => {
    const withRedirects = SEED_PROJECTS.flatMap((p) => p.previousSlugs ?? []);
    const rows = await db.select().from(projectSlugRedirects);

    expect(withRedirects.length).toBeGreaterThan(0);
    expect(rows.map((r) => r.oldSlug).sort()).toEqual([...withRedirects].sort());
  });

  it("is idempotent: running it again leaves the same counts", async () => {
    await seedDatabase(db, upload);

    expect(await db.select().from(projects)).toHaveLength(SEED_PROJECTS.length);
    expect(await db.select().from(projectImages)).toHaveLength(totalImages);
    expect(await db.select().from(architects)).toHaveLength(SEED_ARCHITECTS.length);
  });
});

describe("unseedDatabase", () => {
  it("removes seeded data and files but leaves real projects alone", async () => {
    const [real] = await db.insert(projects).values(projectValues({ slug: "a-real-project" })).returning();
    const removed: string[] = [];
    const storage = {
      list: async () => [...uploaded.keys()],
      remove: async (paths: string[]) => void removed.push(...paths),
    };

    const result = await unseedDatabase(db, storage);

    expect(result).toEqual({ projects: SEED_PROJECTS.length, objects: totalImages });
    expect(removed).toHaveLength(totalImages);
    expect(await db.select({ slug: projects.slug }).from(projects)).toEqual([{ slug: real!.slug }]);
    expect(await db.select().from(projectImages)).toHaveLength(0);
    expect(await db.select().from(architects)).toHaveLength(0);
  });

  it("keeps an architect that a real project still credits", async () => {
    await seedDatabase(db, upload);
    const [real] = await db.select().from(projects).where(eq(projects.slug, "a-real-project"));
    const [nordlys] = await db.select().from(architects).where(eq(architects.slug, "studio-nordlys"));
    await db.insert(projectArchitects).values({ projectId: real!.id, architectId: nordlys!.id });

    await unseedDatabase(db, { list: async () => [], remove: async () => {} });

    expect((await db.select().from(architects)).map((a) => a.slug)).toEqual(["studio-nordlys"]);
  });
});
