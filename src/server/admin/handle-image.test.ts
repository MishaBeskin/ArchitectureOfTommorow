// @vitest-environment node
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { imagePath, tempPath } from "@/lib/image-rules";
import { createTestDb, projectValues, type TestDb } from "@/test/db";
import { projectImages, projects } from "../db/schema";
import { handleAttachImage, handleImageAction, type ImageDeps } from "./handle-image";

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

const jpeg = () => sharp({ create: { width: 800, height: 500, channels: 3, background: "#446688" } }).jpeg().toBuffer();

/** An in-memory stand-in for storage, so the tests can see exactly which files exist. */
function setup() {
  const files = new Map<string, Buffer>();
  const invalidate = vi.fn();
  const warn = vi.fn();
  const remove = vi.fn(async (paths: string[]) => {
    for (const path of paths) files.delete(path);
  });
  const deps: ImageDeps = {
    db,
    storage: {
      download: async (path) => {
        const data = files.get(path);
        if (!data) throw new Error("missing");
        return data;
      },
      upload: async (path, data) => {
        files.set(path, data);
        return `https://storage.test/${path}`;
      },
      remove,
    },
    invalidate,
    newId: () => randomUUID(),
    log: { warn },
  };
  return { deps, files, invalidate, warn, remove };
}

async function makeProject(status: "draft" | "published" = "draft") {
  const [project] = await db
    .insert(projects)
    .values(projectValues({ slug: `p-${randomUUID().slice(0, 6)}`, status }))
    .returning();
  return project!;
}

const meta = { alt: "A facade", caption: "", credit: "" };

describe("handleAttachImage", () => {
  it("re-encodes the upload, stores it under the project, records it, and removes the original", async () => {
    const { deps, files, invalidate } = setup();
    const project = await makeProject();
    const temp = tempPath(project.id, randomUUID());
    files.set(temp, await jpeg());

    const result = await handleAttachImage(deps, { projectId: project.id, tempPath: temp, ...meta, credit: "Jo" });

    expect(result).toEqual({ status: "success", message: "The image was added." });
    const [row] = await db.select().from(projectImages).where(eq(projectImages.projectId, project.id));
    expect(row).toMatchObject({ alt: "A facade", credit: "Jo", caption: null, width: 800, height: 500, sortOrder: 0 });
    expect(row!.pathname).toBe(imagePath(project.id, row!.id));
    expect((await sharp(files.get(row!.pathname)!).metadata()).format).toBe("webp");
    expect(files.has(temp)).toBe(false);
    expect((await db.select().from(projects).where(eq(projects.id, project.id)))[0]!.coverImageId).toBe(row!.id);
    expect(invalidate).toHaveBeenCalledWith(["projects", `project:${project.slug}`]);
  });

  it("rejects a file that is not an image, shows why, and leaves no files or rows behind", async () => {
    const { deps, files } = setup();
    const project = await makeProject();
    const temp = tempPath(project.id, randomUUID());
    files.set(temp, Buffer.from("<svg onload=alert(1)></svg>"));

    const result = await handleAttachImage(deps, { projectId: project.id, tempPath: temp, ...meta });

    expect(result).toMatchObject({ status: "error", message: expect.stringMatching(/Only JPEG|could not be read/) });
    expect(files.size).toBe(0);
    expect(await db.select().from(projectImages)).toHaveLength(0);
  });

  it("requires alt text, and still removes the upload", async () => {
    const { deps, files } = setup();
    const project = await makeProject();
    const temp = tempPath(project.id, randomUUID());
    files.set(temp, await jpeg());

    const result = await handleAttachImage(deps, { projectId: project.id, tempPath: temp, ...meta, alt: "  " });

    expect(result).toMatchObject({ status: "error", errors: { alt: expect.stringContaining("Describe the image") } });
    expect(files.size).toBe(0);
    expect(await db.select().from(projectImages)).toHaveLength(0);
  });

  it("refuses a path that is not exactly this project's temp path, and touches no file", async () => {
    const { deps, files, remove } = setup();
    const project = await makeProject();
    const other = await makeProject();
    const victim = imagePath(other.id, randomUUID());
    files.set(victim, Buffer.from("precious"));

    for (const bad of [victim, tempPath(other.id, randomUUID()), "tmp/../x", 42, null]) {
      const result = await handleAttachImage(deps, { projectId: project.id, tempPath: bad, ...meta });
      expect(result).toMatchObject({ status: "error", message: expect.stringContaining("not valid") });
    }
    expect(await handleAttachImage(deps, { projectId: "nope", tempPath: victim, ...meta })).toMatchObject({
      status: "error",
    });
    expect(remove).not.toHaveBeenCalled();
    expect(files.get(victim)?.toString()).toBe("precious");
  });

  it("cleans up the stored image when the project has vanished", async () => {
    const { deps, files } = setup();
    const gone = randomUUID();
    const temp = tempPath(gone, randomUUID());
    files.set(temp, await jpeg());

    const result = await handleAttachImage(deps, { projectId: gone, tempPath: temp, ...meta });

    expect(result).toMatchObject({ status: "error", message: expect.stringContaining("no longer exists") });
    expect(files.size).toBe(0);
  });

  it("removes what it stored if recording fails, and rethrows", async () => {
    const { deps, files } = setup();
    const project = await makeProject();
    const temp = tempPath(project.id, randomUUID());
    files.set(temp, await jpeg());
    const failing = {
      ...deps,
      db: { ...db, transaction: () => Promise.reject(new Error("db down")) } as unknown as ImageDeps["db"],
    };

    await expect(handleAttachImage(failing, { projectId: project.id, tempPath: temp, ...meta })).rejects.toThrow(
      "db down",
    );
    expect(files.size).toBe(0);
  });

  it("does not fail the upload when removing the original fails, but logs it", async () => {
    const { deps, files, warn } = setup();
    const project = await makeProject();
    const temp = tempPath(project.id, randomUUID());
    files.set(temp, await jpeg());
    deps.storage.remove = vi.fn(async () => {
      throw new Error("storage hiccup");
    });

    const result = await handleAttachImage(deps, { projectId: project.id, tempPath: temp, ...meta });

    expect(result).toMatchObject({ status: "success" });
    expect(warn).toHaveBeenCalled();
  });
});

describe("handleImageAction", () => {
  async function withImages(count = 2, status: "draft" | "published" = "draft") {
    const setupResult = setup();
    const project = await makeProject(status);
    for (let i = 0; i < count; i++) {
      const temp = tempPath(project.id, randomUUID());
      setupResult.files.set(temp, await jpeg());
      await handleAttachImage(setupResult.deps, {
        projectId: project.id,
        tempPath: temp,
        alt: `alt ${i}`,
        caption: "",
        credit: "",
      });
    }
    const rows = await db.select().from(projectImages).where(eq(projectImages.projectId, project.id));
    const ids = rows.sort((a, b) => a.sortOrder - b.sortOrder).map((row) => row.id);
    setupResult.invalidate.mockClear();
    return { ...setupResult, project, ids };
  }
  const fields = { alt: "", caption: "", credit: "" };

  it("saves the details and expires the project's pages", async () => {
    const { deps, ids, project, invalidate } = await withImages();

    const result = await handleImageAction(deps, {
      imageId: ids[0],
      intent: "save",
      alt: "New alt",
      caption: "Cap",
      credit: "",
    });

    expect(result).toEqual({ status: "success", message: "The image details were saved." });
    expect((await db.select().from(projectImages).where(eq(projectImages.id, ids[0]!)))[0]).toMatchObject({
      alt: "New alt",
      caption: "Cap",
    });
    expect(invalidate).toHaveBeenCalledWith(["projects", `project:${project.slug}`]);
  });

  it("will not save blank alt text, and says which image", async () => {
    const { deps, ids } = await withImages();

    const result = await handleImageAction(deps, { imageId: ids[0], intent: "save", ...fields });

    expect(result).toMatchObject({ status: "error", imageId: ids[0], errors: { alt: expect.any(String) } });
  });

  it("moves, sets the cover, and deletes (removing the stored file)", async () => {
    const { deps, ids, project, files } = await withImages(2);
    const order = async () =>
      (await db.select().from(projectImages).where(eq(projectImages.projectId, project.id)))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((r) => r.id);
    const [first, second] = ids;

    await handleImageAction(deps, { imageId: second, intent: "up", ...fields });
    expect(await order()).toEqual([second, first]);

    expect(await handleImageAction(deps, { imageId: second, intent: "cover", ...fields })).toMatchObject({
      status: "success",
    });
    expect((await db.select().from(projects).where(eq(projects.id, project.id)))[0]!.coverImageId).toBe(second);

    const path = (await db.select().from(projectImages).where(eq(projectImages.id, first!)))[0]!.pathname;
    expect(files.has(path)).toBe(true);
    expect(await handleImageAction(deps, { imageId: first, intent: "delete", ...fields })).toEqual({
      status: "success",
      message: "The image was deleted.",
    });
    expect(files.has(path)).toBe(false);
  });

  it("explains why the last image of a published project is kept", async () => {
    const { deps, ids } = await withImages(1, "published");

    const result = await handleImageAction(deps, { imageId: ids[0], intent: "delete", ...fields });

    expect(result).toMatchObject({ status: "error", message: expect.stringContaining("at least one image") });
    expect(await db.select().from(projectImages)).toHaveLength(1);
  });

  it("rejects a bad id or intent, and a missing image", async () => {
    const { deps } = setup();

    expect(await handleImageAction(deps, { imageId: "x", intent: "delete", ...fields })).toMatchObject({
      status: "error",
    });
    expect(await handleImageAction(deps, { imageId: randomUUID(), intent: "explode", ...fields })).toMatchObject({
      status: "error",
    });
    expect(await handleImageAction(deps, { imageId: randomUUID(), intent: "delete", ...fields })).toMatchObject({
      status: "error",
      message: expect.stringContaining("no longer exists"),
    });
  });
});
