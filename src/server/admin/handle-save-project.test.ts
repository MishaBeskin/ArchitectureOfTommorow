// @vitest-environment node
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, projectValues, type TestDb } from "@/test/db";
import { architects, projectSlugRedirects, projects } from "../db/schema";
import { handleSaveProject, type ProjectFormValues } from "./handle-save-project";

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

const form = (overrides: ProjectFormValues = {}): ProjectFormValues => ({
  title: "New Pavilion",
  slug: "new-pavilion",
  summary: "A pavilion.",
  descriptionMd: "Text.",
  type: "cultural",
  phase: "concept",
  year: "2026",
  city: "Oslo",
  region: "",
  countryCode: "NO",
  lat: "",
  lng: "",
  seoTitle: "",
  seoDescription: "",
  architects: [],
  ...overrides,
});

function setup() {
  const invalidate = vi.fn();
  return { deps: { db, invalidate }, invalidate };
}

describe("handleSaveProject: creating", () => {
  it("creates a draft, says so, and expires the list and the new project's page", async () => {
    const { deps, invalidate } = setup();

    const result = await handleSaveProject(deps, { id: "", values: form() });

    expect(result).toMatchObject({ status: "created", message: '"New Pavilion" was created as a draft.' });
    expect(await db.select().from(projects)).toHaveLength(1);
    expect(invalidate).toHaveBeenCalledWith(["projects", "project:new-pavilion"]);
  });

  it("treats a missing id the same as an empty one", async () => {
    const { deps } = setup();

    expect(await handleSaveProject(deps, { id: null, values: form() })).toMatchObject({ status: "created" });
  });

  it("returns the typed values and one message per invalid field, and saves nothing", async () => {
    const { deps, invalidate } = setup();
    const values = form({ title: "", year: "abc", summary: "keep this text" });

    const result = await handleSaveProject(deps, { id: "", values });

    expect(result).toMatchObject({
      status: "error",
      message: "Fix the problems below and save again.",
      errors: { title: "Enter a title.", year: "Enter a year." },
      values,
    });
    expect(await db.select().from(projects)).toHaveLength(0);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("uses the singular when only one field is wrong", async () => {
    const result = await handleSaveProject(setup().deps, { id: "", values: form({ city: "" }) });

    expect(result).toMatchObject({ status: "error", message: "Fix the problem below and save again." });
  });

  it("reports a taken web address on the slug field", async () => {
    await db.insert(projects).values(projectValues({ slug: "new-pavilion" }));
    const { deps, invalidate } = setup();

    const result = await handleSaveProject(deps, { id: "", values: form() });

    expect(result).toMatchObject({
      status: "error",
      errors: { slug: expect.stringContaining("already uses") },
    });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("reports an architect who no longer exists", async () => {
    const values = form({ architects: [{ architectId: randomUUID(), role: "" }] });

    const result = await handleSaveProject(setup().deps, { id: "", values });

    expect(result).toMatchObject({ status: "error", message: expect.stringContaining("no longer exists") });
  });
});

describe("handleSaveProject: editing", () => {
  it("saves the edit and expires both the old and the new address when the slug changes", async () => {
    const [project] = await db.insert(projects).values(projectValues({ slug: "old-name" })).returning();
    const { deps, invalidate } = setup();

    const result = await handleSaveProject(deps, { id: project!.id, values: form({ slug: "new-name", title: "Renamed" }) });

    expect(result).toMatchObject({ status: "saved", id: project!.id, message: '"Renamed" was saved.' });
    expect((await db.select().from(projectSlugRedirects)).map((r) => r.oldSlug)).toEqual(["old-name"]);
    expect(invalidate).toHaveBeenCalledWith(["projects", "project:new-name", "project:old-name"]);
  });

  it("expires each tag once when the slug is unchanged", async () => {
    const [project] = await db.insert(projects).values(projectValues({ slug: "same" })).returning();
    const { deps, invalidate } = setup();

    await handleSaveProject(deps, { id: project!.id, values: form({ slug: "same" }) });

    expect(invalidate).toHaveBeenCalledWith(["projects", "project:same"]);
  });

  it("refuses an id that is not a UUID before touching the database", async () => {
    const { deps, invalidate } = setup();

    const result = await handleSaveProject(deps, { id: "1; drop table projects", values: form() });

    expect(result).toMatchObject({ status: "error", message: expect.stringContaining("not valid") });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("says when the project has been deleted in the meantime", async () => {
    const result = await handleSaveProject(setup().deps, { id: randomUUID(), values: form() });

    expect(result).toMatchObject({ status: "error", message: expect.stringContaining("no longer exists") });
  });

  it("lists what is wrong when an edit would leave a published project unpublishable", async () => {
    const [project] = await db
      .insert(projects)
      .values(projectValues({ slug: "live", status: "published", summary: "Ready." }))
      .returning();

    const result = await handleSaveProject(setup().deps, { id: project!.id, values: form({ slug: "live", summary: "" }) });

    expect(result).toMatchObject({ status: "error", problems: expect.arrayContaining(["Add a summary."]) });
    expect((await db.select().from(projects).where(eq(projects.id, project!.id)))[0]!.summary).toBe("Ready.");
  });
});
