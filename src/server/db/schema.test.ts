// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, projectValues, type TestDb } from "@/test/db";
import {
  architects,
  projectArchitects,
  projectImages,
  projects,
  projectSlugRedirects,
} from "./schema";

let db: TestDb;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

/** Drizzle wraps driver errors; the constraint name lives on the cause. */
async function expectViolation(promise: Promise<unknown>, constraint: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, `expected a violation of ${constraint}`).not.toBeNull();
  const { message, cause } = error as { message: string; cause?: { message?: string } };
  expect(`${message} ${cause?.message ?? ""}`).toContain(constraint);
}

async function insertProject(overrides: Parameters<typeof projectValues>[0] = {}) {
  const [row] = await db.insert(projects).values(projectValues(overrides)).returning();
  return row!;
}

const image = (projectId: string, overrides = {}) => ({
  projectId,
  url: "https://example.test/a.webp",
  pathname: "projects/a.webp",
  width: 1600,
  height: 900,
  alt: "Facade at dusk",
  blurDataUrl: "data:image/webp;base64,AAAA",
  ...overrides,
});

describe("projects", () => {
  it("applies defaults: draft, completed, not featured", async () => {
    const row = await insertProject({ slug: "defaults" });

    expect(row).toMatchObject({ status: "draft", phase: "completed", featured: false, descriptionMd: "" });
  });

  it("rejects a duplicate slug", async () => {
    await insertProject({ slug: "dup" });

    await expectViolation(insertProject({ slug: "dup" }), "projects_slug_key");
  });

  it.each([1899, 2101])("rejects year %i outside 1900-2100", async (year) => {
    await expectViolation(insertProject({ slug: `year-${year}`, year }), "projects_year_range");
  });

  it("accepts the year bounds", async () => {
    await insertProject({ slug: "year-min", year: 1900 });
    await insertProject({ slug: "year-max", year: 2100 });
  });

  it("rejects a lower-case country code", async () => {
    await expectViolation(
      insertProject({ slug: "lower-cc", countryCode: "it" }),
      "projects_country_code_upper",
    );
  });

  it("rejects a summary over 300 characters", async () => {
    await expectViolation(
      insertProject({ slug: "long-summary", summary: "x".repeat(301) }),
      "projects_summary_length",
    );
  });

  it("rejects an unknown project type", async () => {
    await expect(insertProject({ slug: "bad-type", type: "castle" as never })).rejects.toThrow();
  });
});

describe("project images", () => {
  it("are deleted with their project", async () => {
    const project = await insertProject({ slug: "cascade-images" });
    await db.insert(projectImages).values(image(project.id));

    await db.delete(projects).where(eq(projects.id, project.id));

    expect(await db.select().from(projectImages).where(eq(projectImages.projectId, project.id))).toHaveLength(0);
  });

  it("clear the cover reference when the cover image is deleted", async () => {
    const project = await insertProject({ slug: "cover-set-null" });
    const [cover] = await db.insert(projectImages).values(image(project.id)).returning();
    await db.update(projects).set({ coverImageId: cover!.id }).where(eq(projects.id, project.id));

    await db.delete(projectImages).where(eq(projectImages.id, cover!.id));

    const [after] = await db.select().from(projects).where(eq(projects.id, project.id));
    expect(after!.coverImageId).toBeNull();
  });

  it("require positive dimensions", async () => {
    const project = await insertProject({ slug: "bad-dimensions" });

    await expectViolation(
      db.insert(projectImages).values(image(project.id, { width: 0 })),
      "project_images_dimensions_positive",
    );
  });
});

describe("architects", () => {
  async function insertArchitect(slug: string) {
    const [row] = await db.insert(architects).values({ slug, name: slug }).returning();
    return row!;
  }

  it("cannot be deleted while a project still credits them", async () => {
    const project = await insertProject({ slug: "restrict-project" });
    const architect = await insertArchitect("restrict-architect");
    await db.insert(projectArchitects).values({ projectId: project.id, architectId: architect.id });

    await expect(db.delete(architects).where(eq(architects.id, architect.id))).rejects.toThrow();
  });

  it("credits are removed with the project, after which the architect can be deleted", async () => {
    const project = await insertProject({ slug: "cascade-credits" });
    const architect = await insertArchitect("cascade-architect");
    await db.insert(projectArchitects).values({ projectId: project.id, architectId: architect.id });

    await db.delete(projects).where(eq(projects.id, project.id));
    await db.delete(architects).where(eq(architects.id, architect.id));

    expect(await db.select().from(architects).where(eq(architects.id, architect.id))).toHaveLength(0);
  });

  it("have unique slugs", async () => {
    await insertArchitect("same-slug");

    await expectViolation(insertArchitect("same-slug"), "architects_slug_key");
  });
});

describe("slug redirects", () => {
  it("are deleted with their project", async () => {
    const project = await insertProject({ slug: "redirect-target" });
    await db.insert(projectSlugRedirects).values({ oldSlug: "old-name", projectId: project.id });

    await db.delete(projects).where(eq(projects.id, project.id));

    expect(await db.select().from(projectSlugRedirects).where(eq(projectSlugRedirects.oldSlug, "old-name"))).toHaveLength(0);
  });
});
