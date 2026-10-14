// @vitest-environment node
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, projectValues, type TestDb } from "@/test/db";
import { projectImages, projects } from "../db/schema";
import { handleProjectAction, type ProjectActionDeps } from "./handle-project-action";

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

function makeDeps(overrides: Partial<ProjectActionDeps> = {}) {
  const invalidate = vi.fn();
  const removeFiles = vi.fn(async () => {});
  const log = { warn: vi.fn() };
  return { deps: { db, invalidate, removeFiles, log, ...overrides } satisfies ProjectActionDeps, invalidate, removeFiles, log };
}

async function addProject(slug: string, { ready = true, status = "draft" as "draft" | "published" } = {}) {
  const [project] = await db
    .insert(projects)
    .values(projectValues({ slug, title: `Title ${slug}`, summary: ready ? "A summary." : "x", status }))
    .returning();
  if (ready) {
    const [image] = await db
      .insert(projectImages)
      .values({
        projectId: project!.id,
        url: "https://storage.test/a.webp",
        pathname: `projects/${slug}/1.webp`,
        width: 100,
        height: 100,
        alt: "An image",
        blurDataUrl: "data:image/webp;base64,AAAA",
      })
      .returning();
    await db.update(projects).set({ coverImageId: image!.id }).where(eq(projects.id, project!.id));
  }
  return project!;
}

describe("invalid input", () => {
  it.each([
    [{ id: "not-a-uuid", intent: "publish" }],
    [{ id: randomUUID(), intent: "explode" }],
    [{ id: null, intent: "publish" }],
    [{ id: randomUUID(), intent: null }],
    [{ id: undefined, intent: undefined }],
    [{ id: `${randomUUID()}; drop table projects`, intent: "delete" }],
  ])("rejects %j without touching anything", async (raw) => {
    const { deps, invalidate } = makeDeps();

    const result = await handleProjectAction(deps, raw);

    expect(result).toMatchObject({ status: "error", message: expect.stringContaining("not valid") });
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe("publish and unpublish", () => {
  it("publishes a ready project, says so, and expires the list and that project's cache tags", async () => {
    const project = await addProject("shiny");
    const { deps, invalidate } = makeDeps();

    const result = await handleProjectAction(deps, { id: project.id, intent: "publish" });

    expect(result).toEqual({ status: "success", message: '"Title shiny" is now published.' });
    expect(invalidate).toHaveBeenCalledWith(["projects", "project:shiny"]);
    expect((await db.select().from(projects))[0]!.status).toBe("published");
  });

  it("refuses to publish an unready project, lists what is missing, and expires nothing", async () => {
    const project = await addProject("raw", { ready: false });
    const { deps, invalidate } = makeDeps();

    const result = await handleProjectAction(deps, { id: project.id, intent: "publish" });

    expect(result).toMatchObject({
      status: "error",
      message: '"Title raw" cannot be published yet.',
      problems: expect.arrayContaining(["Add at least one image."]),
    });
    expect(invalidate).not.toHaveBeenCalled();
    expect((await db.select().from(projects))[0]!.status).toBe("draft");
  });

  it("unpublishes a project and expires the cache so it disappears from the site", async () => {
    const project = await addProject("live", { status: "published" });
    const { deps, invalidate } = makeDeps();

    const result = await handleProjectAction(deps, { id: project.id, intent: "unpublish" });

    expect(result).toEqual({ status: "success", message: '"Title live" is now a draft and no longer public.' });
    expect(invalidate).toHaveBeenCalledWith(["projects", "project:live"]);
  });
});

describe("featured", () => {
  it("features a project and expires the cache so the home page updates", async () => {
    const project = await addProject("star", { status: "published" });
    const { deps, invalidate } = makeDeps();

    const result = await handleProjectAction(deps, { id: project.id, intent: "feature" });

    expect(result).toEqual({ status: "success", message: '"Title star" is featured on the home page.' });
    expect(invalidate).toHaveBeenCalledWith(["projects", "project:star"]);
  });

  it("warns that a featured draft will only appear once it is published", async () => {
    const project = await addProject("quiet", { status: "draft" });
    const { deps } = makeDeps();

    const result = await handleProjectAction(deps, { id: project.id, intent: "feature" });

    expect(result).toMatchObject({ status: "success", message: expect.stringContaining("It will appear once it is published.") });
  });

  it("un-features a project", async () => {
    const project = await addProject("fade", { status: "published" });
    const { deps, invalidate } = makeDeps();
    await handleProjectAction(deps, { id: project.id, intent: "feature" });
    invalidate.mockClear();

    const result = await handleProjectAction(deps, { id: project.id, intent: "unfeature" });

    expect(result).toEqual({ status: "success", message: '"Title fade" is no longer featured.' });
    expect(invalidate).toHaveBeenCalledWith(["projects", "project:fade"]);
  });
});

describe("delete", () => {
  it("deletes the project, removes its stored files and expires the cache", async () => {
    const project = await addProject("bye");
    const { deps, invalidate, removeFiles } = makeDeps();

    const result = await handleProjectAction(deps, { id: project.id, intent: "delete" });

    expect(result).toEqual({ status: "success", message: '"Title bye" was deleted.' });
    expect(removeFiles).toHaveBeenCalledWith(["projects/bye/1.webp"]);
    expect(invalidate).toHaveBeenCalledWith(["projects", "project:bye"]);
    expect(await db.select().from(projects)).toHaveLength(0);
  });

  it("still reports success when the files cannot be removed, because the project is already gone", async () => {
    const project = await addProject("orphan");
    const { deps, log } = makeDeps({
      removeFiles: vi.fn(async () => {
        throw new Error("storage unavailable");
      }),
    });

    const result = await handleProjectAction(deps, { id: project.id, intent: "delete" });

    expect(result).toEqual({ status: "success", message: '"Title orphan" was deleted.' });
    expect(log.warn).toHaveBeenCalled();
    expect(await db.select().from(projects)).toHaveLength(0);
  });
});

describe("a project that no longer exists", () => {
  it.each(["publish", "unpublish", "feature", "unfeature", "delete"])(
    "answers %s with a helpful message and expires nothing",
    async (intent) => {
      const { deps, invalidate, removeFiles } = makeDeps();

      const result = await handleProjectAction(deps, { id: randomUUID(), intent });

      expect(result).toMatchObject({ status: "error", message: expect.stringContaining("no longer exists") });
      expect(invalidate).not.toHaveBeenCalled();
      expect(removeFiles).not.toHaveBeenCalled();
    },
  );
});
