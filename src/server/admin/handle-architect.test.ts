// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, projectValues, type TestDb } from "@/test/db";
import { architects, projectArchitects, projects } from "../db/schema";
import { handleDeleteArchitect, handleSaveArchitect } from "./handle-architect";

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

const form = (overrides: Record<string, unknown> = {}) => ({
  name: "Ada Okafor",
  slug: "ada-okafor",
  websiteUrl: "",
  bio: "",
  ...overrides,
});

function setup() {
  const invalidate = vi.fn();
  return { deps: { db, invalidate }, invalidate };
}

describe("handleSaveArchitect", () => {
  it("adds an architect without touching the public cache", async () => {
    const { deps, invalidate } = setup();

    const result = await handleSaveArchitect(deps, { id: "", values: form() });

    expect(result).toMatchObject({ status: "created", message: '"Ada Okafor" was added.' });
    expect(await db.select().from(architects)).toHaveLength(1);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("returns the typed values and field errors, and saves nothing", async () => {
    const values = form({ name: "", websiteUrl: "javascript:alert(1)" });

    const result = await handleSaveArchitect(setup().deps, { id: null, values });

    expect(result).toMatchObject({
      status: "error",
      message: "Fix the problems below and save again.",
      errors: { name: "Enter a name.", websiteUrl: expect.stringContaining("https://") },
      values,
    });
    expect(await db.select().from(architects)).toHaveLength(0);
  });

  it("reports a taken web address on the slug field", async () => {
    await db.insert(architects).values({ slug: "ada-okafor", name: "Existing" });

    const result = await handleSaveArchitect(setup().deps, { id: "", values: form() });

    expect(result).toMatchObject({ status: "error", errors: { slug: expect.stringContaining("already uses") } });
  });

  it("saves an edit and expires the pages of every project that credits them", async () => {
    const [architect] = await db.insert(architects).values({ slug: "ada-okafor", name: "Ada" }).returning();
    const [project] = await db.insert(projects).values(projectValues({ slug: "credited" })).returning();
    await db.insert(projectArchitects).values({ projectId: project!.id, architectId: architect!.id });
    const { deps, invalidate } = setup();

    const result = await handleSaveArchitect(deps, { id: architect!.id, values: form({ name: "Ada O." }) });

    expect(result).toMatchObject({ status: "saved", message: '"Ada O." was saved.' });
    expect(invalidate).toHaveBeenCalledWith(["projects", "project:credited"]);
  });

  it("refuses an id that is not a UUID, and says when the architect is gone", async () => {
    expect(await handleSaveArchitect(setup().deps, { id: "1; drop table architects", values: form() })).toMatchObject({
      status: "error",
      message: expect.stringContaining("not valid"),
    });
    expect(await handleSaveArchitect(setup().deps, { id: randomUUID(), values: form() })).toMatchObject({
      status: "error",
      message: expect.stringContaining("no longer exists"),
    });
  });
});

describe("handleDeleteArchitect", () => {
  it("deletes an unused architect", async () => {
    const [architect] = await db.insert(architects).values({ slug: "x", name: "Xan" }).returning();

    expect(await handleDeleteArchitect(setup().deps, { id: architect!.id })).toEqual({
      status: "success",
      message: '"Xan" was deleted.',
    });
  });

  it("explains why a credited architect was kept", async () => {
    const [architect] = await db.insert(architects).values({ slug: "x", name: "Xan" }).returning();
    const [project] = await db.insert(projects).values(projectValues({ slug: "p" })).returning();
    await db.insert(projectArchitects).values({ projectId: project!.id, architectId: architect!.id });

    const result = await handleDeleteArchitect(setup().deps, { id: architect!.id });

    expect(result).toMatchObject({ status: "error", message: expect.stringContaining("credited on 1 project") });
    expect(await db.select().from(architects)).toHaveLength(1);
  });

  it("rejects a bad id and a missing architect", async () => {
    expect(await handleDeleteArchitect(setup().deps, { id: "nope" })).toMatchObject({ status: "error" });
    expect(await handleDeleteArchitect(setup().deps, { id: randomUUID() })).toMatchObject({
      status: "error",
      message: expect.stringContaining("no longer exists"),
    });
  });
});
