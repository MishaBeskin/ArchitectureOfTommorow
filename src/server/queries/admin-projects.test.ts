// @vitest-environment node
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, projectValues, type TestDb } from "@/test/db";
import { architects, projectArchitects, projectImages, projects } from "../db/schema";
import { getAdminProjectById, getProjectForEdit, listAdminProjects, listArchitectOptions } from "./admin-projects";

let db: TestDb;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.delete(projects);
  await db.delete(architects);
});

async function addProject(slug: string, overrides: Partial<ReturnType<typeof projectValues>> = {}, images = 0) {
  const [project] = await db.insert(projects).values(projectValues({ slug, title: `Title ${slug}`, ...overrides })).returning();
  for (let i = 0; i < images; i++) {
    await db.insert(projectImages).values({
      projectId: project!.id,
      url: `https://storage.test/${slug}/${i}.webp`,
      pathname: `${slug}/${i}.webp`,
      width: 100,
      height: 100,
      alt: "x",
      blurDataUrl: "data:image/webp;base64,AAAA",
      sortOrder: i,
    });
  }
  return project!;
}

describe("listAdminProjects", () => {
  it("includes drafts as well as published projects, which the public queries never do", async () => {
    await addProject("live", { status: "published" });
    await addProject("hidden", { status: "draft" });

    const rows = await listAdminProjects(db);

    expect(rows.map((r) => [r.slug, r.status]).sort()).toEqual([
      ["hidden", "draft"],
      ["live", "published"],
    ]);
  });

  it("counts each project's images", async () => {
    await addProject("none");
    await addProject("three", {}, 3);

    const rows = Object.fromEntries((await listAdminProjects(db)).map((r) => [r.slug, r.imageCount]));

    expect(rows).toEqual({ none: 0, three: 3 });
  });

  it("returns what the table shows: title, type, year, location and featured state", async () => {
    await addProject("full", { type: "civic", year: 2023, city: "Nairobi", countryCode: "KE", featured: true, featuredOrder: 2 });

    const [row] = await listAdminProjects(db);

    expect(row).toMatchObject({
      slug: "full",
      title: "Title full",
      type: "civic",
      year: 2023,
      city: "Nairobi",
      countryCode: "KE",
      featured: true,
      featuredOrder: 2,
    });
    expect(row!.updatedAt).toBeInstanceOf(Date);
  });

  it("lists the most recently edited project first", async () => {
    const older = await addProject("older");
    const newer = await addProject("newer");
    await db.update(projects).set({ updatedAt: new Date("2024-01-01T00:00:00Z") }).where(eq(projects.id, older.id));
    await db.update(projects).set({ updatedAt: new Date("2025-06-01T00:00:00Z") }).where(eq(projects.id, newer.id));

    expect((await listAdminProjects(db)).map((r) => r.slug)).toEqual(["newer", "older"]);

    await db.update(projects).set({ updatedAt: new Date("2026-01-01T00:00:00Z") }).where(eq(projects.id, older.id));
    expect((await listAdminProjects(db)).map((r) => r.slug)).toEqual(["older", "newer"]);
  });

  it("returns an empty list when there are no projects", async () => {
    expect(await listAdminProjects(db)).toEqual([]);
  });
});

describe("getAdminProjectById", () => {
  it("finds a draft by id", async () => {
    const draft = await addProject("find-me");

    expect((await getAdminProjectById(db, draft.id))?.slug).toBe("find-me");
  });

  it("returns null for an unknown id", async () => {
    expect(await getAdminProjectById(db, randomUUID())).toBeNull();
  });
});

describe("getProjectForEdit", () => {
  it("returns the project with its credits in order and its images in order", async () => {
    const project = await addProject("editable", {}, 2);
    const [a, b] = await db
      .insert(architects)
      .values([
        { slug: "ada", name: "Ada" },
        { slug: "ben", name: "Ben" },
      ])
      .returning();
    await db.insert(projectArchitects).values([
      { projectId: project.id, architectId: a!.id, role: null, sortOrder: 1 },
      { projectId: project.id, architectId: b!.id, role: "Lead", sortOrder: 0 },
    ]);

    const found = await getProjectForEdit(db, project.id);

    expect(found?.project.slug).toBe("editable");
    expect(found?.credits).toEqual([
      { architectId: b!.id, role: "Lead" },
      { architectId: a!.id, role: null },
    ]);
    expect(found?.images).toHaveLength(2);
  });

  it("returns null for an unknown id", async () => {
    expect(await getProjectForEdit(db, randomUUID())).toBeNull();
  });
});

describe("listArchitectOptions", () => {
  it("lists architects by name", async () => {
    await db.insert(architects).values([
      { slug: "zed", name: "Zed" },
      { slug: "amy", name: "Amy" },
    ]);

    expect((await listArchitectOptions(db)).map((a) => a.name)).toEqual(["Amy", "Zed"]);
  });
});
