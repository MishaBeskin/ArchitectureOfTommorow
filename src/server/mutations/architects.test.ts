// @vitest-environment node
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ArchitectInput } from "@/lib/architect-schema";
import { createTestDb, projectValues, type TestDb } from "@/test/db";
import { architects, projectArchitects, projects } from "../db/schema";
import { createArchitect, deleteArchitect, updateArchitect } from "./architects";

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

const input = (overrides: Partial<ArchitectInput> = {}): ArchitectInput => ({
  name: "Ada Okafor",
  slug: "ada-okafor",
  websiteUrl: null,
  bio: null,
  ...overrides,
});

async function credit(architectId: string, slug: string) {
  const [project] = await db.insert(projects).values(projectValues({ slug })).returning();
  await db.insert(projectArchitects).values({ projectId: project!.id, architectId });
  return project!;
}

describe("createArchitect", () => {
  it("creates an architect with every field", async () => {
    const result = await createArchitect(db, input({ websiteUrl: "https://ada.example", bio: "Bio" }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((await db.select().from(architects).where(eq(architects.id, result.id)))[0]).toMatchObject({
      name: "Ada Okafor",
      slug: "ada-okafor",
      websiteUrl: "https://ada.example",
      bio: "Bio",
    });
  });

  it("refuses a slug already in use and creates nothing more", async () => {
    await createArchitect(db, input());

    expect(await createArchitect(db, input({ name: "Other" }))).toEqual({ ok: false, reason: "slug-taken" });
    expect(await db.select().from(architects)).toHaveLength(1);
  });
});

describe("updateArchitect", () => {
  it("saves the edit and reports the slugs of the projects that credit them", async () => {
    const created = await createArchitect(db, input());
    if (!created.ok) throw new Error("setup");
    await credit(created.id, "project-one");
    await credit(created.id, "project-two");

    const result = await updateArchitect(db, created.id, input({ name: "Ada O.", bio: "New" }));

    expect(result).toMatchObject({ ok: true, name: "Ada O." });
    if (!result.ok) return;
    expect(result.projectSlugs.sort()).toEqual(["project-one", "project-two"]);
    expect((await db.select().from(architects))[0]).toMatchObject({ name: "Ada O.", bio: "New" });
  });

  it("allows keeping the same slug, but not taking another architect's", async () => {
    const a = await createArchitect(db, input());
    await createArchitect(db, input({ name: "Ben", slug: "ben" }));
    if (!a.ok) throw new Error("setup");

    expect(await updateArchitect(db, a.id, input({ name: "Renamed" }))).toMatchObject({ ok: true });
    expect(await updateArchitect(db, a.id, input({ slug: "ben" }))).toEqual({ ok: false, reason: "slug-taken" });
  });

  it("reports a missing architect", async () => {
    expect(await updateArchitect(db, randomUUID(), input())).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("deleteArchitect", () => {
  it("deletes an architect nobody is credited as", async () => {
    const created = await createArchitect(db, input());
    if (!created.ok) throw new Error("setup");

    expect(await deleteArchitect(db, created.id)).toEqual({ ok: true, name: "Ada Okafor" });
    expect(await db.select().from(architects)).toHaveLength(0);
  });

  it("refuses while projects credit them, and keeps everything", async () => {
    const created = await createArchitect(db, input());
    if (!created.ok) throw new Error("setup");
    await credit(created.id, "credited");

    expect(await deleteArchitect(db, created.id)).toEqual({
      ok: false,
      reason: "in-use",
      name: "Ada Okafor",
      projectCount: 1,
    });
    expect(await db.select().from(architects)).toHaveLength(1);
    expect(await db.select().from(projectArchitects)).toHaveLength(1);
  });

  it("reports a missing architect", async () => {
    expect(await deleteArchitect(db, randomUUID())).toEqual({ ok: false, reason: "not-found" });
  });
});
