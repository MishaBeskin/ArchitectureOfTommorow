// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { IMAGE_LIMITS, parseTempPath } from "@/lib/image-rules";
import { createTestDb, projectValues, type TestDb } from "@/test/db";
import { projectImages, projects } from "../db/schema";
import { handleUploadRequest } from "./handle-upload-request";

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
});

function setup() {
  const createSlot = vi.fn(async (path: string) => ({ path, token: "tok" }));
  return { deps: { db, createSlot, newId: () => randomUUID() }, createSlot };
}

async function makeProject() {
  const [project] = await db
    .insert(projects)
    .values(projectValues({ slug: `p-${randomUUID().slice(0, 6)}` }))
    .returning();
  return project!;
}

describe("handleUploadRequest", () => {
  it("hands out a one-time slot at a temp path inside the project", async () => {
    const { deps, createSlot } = setup();
    const project = await makeProject();

    const result = await handleUploadRequest(deps, { projectId: project.id, contentType: "image/jpeg", size: 5000 });

    expect(result.status).toBe(200);
    if (result.status !== 200) return;
    expect(result.body.token).toBe("tok");
    expect(parseTempPath(result.body.path)).toMatchObject({ projectId: project.id });
    expect(createSlot).toHaveBeenCalledTimes(1);
  });

  it.each(["image/svg+xml", "image/gif", "text/html", "application/pdf", ""])(
    "refuses the type %j before any slot exists",
    async (contentType) => {
      const { deps, createSlot } = setup();
      const project = await makeProject();

      const result = await handleUploadRequest(deps, { projectId: project.id, contentType, size: 100 });

      expect(result.status).toBe(400);
      expect(createSlot).not.toHaveBeenCalled();
    },
  );

  it("refuses files that are too large, empty, or whose size is not a number", async () => {
    const { deps } = setup();
    const project = await makeProject();

    const large = await handleUploadRequest(deps, {
      projectId: project.id,
      contentType: "image/png",
      size: IMAGE_LIMITS.maxBytes + 1,
    });
    expect(large).toMatchObject({ status: 400, body: { error: "The file is larger than 30 MB." } });
    for (const size of [0, -5, 1.5, "10", null]) {
      expect((await handleUploadRequest(deps, { projectId: project.id, contentType: "image/png", size })).status).toBe(
        400,
      );
    }
  });

  it("refuses malformed input and unknown projects", async () => {
    const { deps, createSlot } = setup();

    for (const raw of [null, "x", {}, { projectId: "nope", contentType: "image/png", size: 5 }]) {
      expect((await handleUploadRequest(deps, raw)).status).toBe(400);
    }
    expect(
      (await handleUploadRequest(deps, { projectId: randomUUID(), contentType: "image/png", size: 5 })).status,
    ).toBe(404);
    expect(createSlot).not.toHaveBeenCalled();
  });

  it("refuses when the project already has the most images", async () => {
    const { deps, createSlot } = setup();
    const project = await makeProject();
    await db.insert(projectImages).values(
      Array.from({ length: IMAGE_LIMITS.perProject }, (_, i) => ({
        projectId: project.id,
        url: `https://s.test/${i}`,
        pathname: `p/${i}`,
        width: 10,
        height: 10,
        alt: "x",
        blurDataUrl: "data:,",
        sortOrder: i,
      })),
    );

    const result = await handleUploadRequest(deps, { projectId: project.id, contentType: "image/png", size: 5 });

    expect(result.status).toBe(409);
    expect(createSlot).not.toHaveBeenCalled();
  });
});
