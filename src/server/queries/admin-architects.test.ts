// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, projectValues, type TestDb } from "@/test/db";
import { architects, projectArchitects, projects } from "../db/schema";
import { getArchitectById, listAdminArchitects } from "./admin-architects";

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

describe("listAdminArchitects", () => {
  it("lists architects by name with how many projects credit each", async () => {
    const [zed, amy] = await db
      .insert(architects)
      .values([
        { slug: "zed", name: "Zed" },
        { slug: "amy", name: "Amy" },
      ])
      .returning();
    for (const slug of ["p1", "p2"]) {
      const [project] = await db.insert(projects).values(projectValues({ slug })).returning();
      await db.insert(projectArchitects).values({ projectId: project!.id, architectId: zed!.id });
    }

    const rows = await listAdminArchitects(db);

    expect(rows.map((r) => [r.name, r.projectCount])).toEqual([
      ["Amy", 0],
      ["Zed", 2],
    ]);
    expect(rows[0]!.id).toBe(amy!.id);
  });

  it("is empty when there are none", async () => {
    expect(await listAdminArchitects(db)).toEqual([]);
  });
});

describe("getArchitectById", () => {
  it("finds an architect, and returns null for an unknown id", async () => {
    const [a] = await db.insert(architects).values({ slug: "a", name: "A" }).returning();

    expect((await getArchitectById(db, a!.id))?.name).toBe("A");
    expect(await getArchitectById(db, randomUUID())).toBeNull();
  });
});
