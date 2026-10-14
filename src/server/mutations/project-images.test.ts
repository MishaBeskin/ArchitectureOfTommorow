// @vitest-environment node
import { asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { IMAGE_LIMITS } from "@/lib/image-rules";
import { createTestDb, projectValues, type TestDb } from "@/test/db";
import { projectImages, projects } from "../db/schema";
import { addImage, deleteImage, moveImage, setCoverImage, updateImageMeta, type NewImage } from "./project-images";

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

const image = (overrides: Partial<NewImage> = {}): NewImage => {
  const id = overrides.id ?? randomUUID();
  return {
    id,
    url: `https://storage.test/${id}.webp`,
    pathname: `projects/p/${id}.webp`,
    width: 1600,
    height: 1000,
    blurDataUrl: "data:image/webp;base64,AAAA",
    alt: "An image",
    caption: null,
    credit: null,
    ...overrides,
  };
};

async function makeProject(status: "draft" | "published" = "draft") {
  const [project] = await db
    .insert(projects)
    .values(projectValues({ slug: `p-${randomUUID().slice(0, 6)}`, status }))
    .returning();
  return project!;
}

const order = async (projectId: string) =>
  (
    await db
      .select()
      .from(projectImages)
      .where(eq(projectImages.projectId, projectId))
      .orderBy(asc(projectImages.sortOrder))
  ).map((row) => row.alt);
const cover = async (projectId: string) =>
  (await db.select().from(projects).where(eq(projects.id, projectId)))[0]!.coverImageId;

describe("addImage", () => {
  it("stores the image, makes the first one the cover, and appends later ones", async () => {
    const project = await makeProject();
    const first = image({ alt: "one", caption: "Caption", credit: "Jo" });

    expect(await addImage(db, project.id, first)).toMatchObject({
      ok: true,
      id: first.id,
      slug: project.slug,
      status: "draft",
    });
    await addImage(db, project.id, image({ alt: "two" }));

    expect(await order(project.id)).toEqual(["one", "two"]);
    expect(await cover(project.id)).toBe(first.id);
    expect((await db.select().from(projectImages).where(eq(projectImages.id, first.id)))[0]).toMatchObject({
      caption: "Caption",
      credit: "Jo",
      width: 1600,
      sortOrder: 0,
    });
  });

  it("keeps an existing cover when more images are added", async () => {
    const project = await makeProject();
    const first = image({ alt: "one" });
    await addImage(db, project.id, first);

    await addImage(db, project.id, image({ alt: "two" }));

    expect(await cover(project.id)).toBe(first.id);
  });

  it("refuses beyond the per-project limit, and for a project that does not exist", async () => {
    const project = await makeProject();
    for (let i = 0; i < IMAGE_LIMITS.perProject; i++) await addImage(db, project.id, image({ alt: `i${i}` }));

    expect(await addImage(db, project.id, image())).toEqual({ ok: false, reason: "limit" });
    expect(await addImage(db, randomUUID(), image())).toEqual({ ok: false, reason: "not-found" });
    expect(await order(project.id)).toHaveLength(IMAGE_LIMITS.perProject);
  });
});

describe("updateImageMeta", () => {
  it("changes alt, caption and credit, and reports the project", async () => {
    const project = await makeProject("published");
    const img = image();
    await addImage(db, project.id, img);

    const result = await updateImageMeta(db, img.id, { alt: "New alt", caption: "New caption", credit: null });

    expect(result).toMatchObject({ ok: true, slug: project.slug, status: "published" });
    expect((await db.select().from(projectImages))[0]).toMatchObject({
      alt: "New alt",
      caption: "New caption",
      credit: null,
    });
  });

  it("reports a missing image", async () => {
    expect(await updateImageMeta(db, randomUUID(), { alt: "x", caption: null, credit: null })).toEqual({
      ok: false,
      reason: "not-found",
    });
  });
});

describe("moveImage", () => {
  async function three() {
    const project = await makeProject();
    const imgs = [image({ alt: "a" }), image({ alt: "b" }), image({ alt: "c" })];
    for (const img of imgs) await addImage(db, project.id, img);
    return { project, imgs };
  }

  it("moves an image up and down", async () => {
    const { project, imgs } = await three();

    await moveImage(db, imgs[2]!.id, "up");
    expect(await order(project.id)).toEqual(["a", "c", "b"]);

    await moveImage(db, imgs[0]!.id, "down");
    expect(await order(project.id)).toEqual(["c", "a", "b"]);
  });

  it("does nothing at either end, and keeps the orders 0..n-1", async () => {
    const { project, imgs } = await three();

    await moveImage(db, imgs[0]!.id, "up");
    await moveImage(db, imgs[2]!.id, "down");

    expect(await order(project.id)).toEqual(["a", "b", "c"]);
    const orders = (await db.select().from(projectImages).where(eq(projectImages.projectId, project.id))).map(
      (r) => r.sortOrder,
    );
    expect(orders.sort()).toEqual([0, 1, 2]);
  });

  it("repairs gaps left by earlier deletions", async () => {
    const { project, imgs } = await three();
    await deleteImage(db, imgs[1]!.id);

    await moveImage(db, imgs[2]!.id, "up");

    expect(await order(project.id)).toEqual(["c", "a"]);
    expect((await db.select().from(projectImages).orderBy(asc(projectImages.sortOrder))).map((r) => r.sortOrder)).toEqual([
      0, 1,
    ]);
  });

  it("reports a missing image", async () => {
    expect(await moveImage(db, randomUUID(), "up")).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("setCoverImage", () => {
  it("makes the chosen image the cover", async () => {
    const project = await makeProject();
    const [a, b] = [image({ alt: "a" }), image({ alt: "b" })];
    await addImage(db, project.id, a);
    await addImage(db, project.id, b);

    expect(await setCoverImage(db, b.id)).toMatchObject({ ok: true });
    expect(await cover(project.id)).toBe(b.id);
    expect(await setCoverImage(db, randomUUID())).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("deleteImage", () => {
  it("removes the image and returns its stored path", async () => {
    const project = await makeProject();
    const [a, b] = [image({ alt: "a" }), image({ alt: "b" })];
    await addImage(db, project.id, a);
    await addImage(db, project.id, b);

    const result = await deleteImage(db, b.id);

    expect(result).toMatchObject({ ok: true, pathname: b.pathname });
    expect(await order(project.id)).toEqual(["a"]);
    expect(await cover(project.id)).toBe(a.id);
  });

  it("hands the cover to the first remaining image when the cover is deleted", async () => {
    const project = await makeProject();
    const [a, b, c] = [image({ alt: "a" }), image({ alt: "b" }), image({ alt: "c" })];
    for (const img of [a, b, c]) await addImage(db, project.id, img);

    await deleteImage(db, a.id);

    expect(await cover(project.id)).toBe(b.id);
  });

  it("lets a draft lose its last image, leaving no cover", async () => {
    const project = await makeProject();
    const only = image();
    await addImage(db, project.id, only);

    expect(await deleteImage(db, only.id)).toMatchObject({ ok: true });
    expect(await cover(project.id)).toBeNull();
  });

  it("keeps the last image of a published project", async () => {
    const project = await makeProject("published");
    const only = image();
    await addImage(db, project.id, only);

    expect(await deleteImage(db, only.id)).toEqual({ ok: false, reason: "last-image" });
    expect(await order(project.id)).toHaveLength(1);
    expect(await cover(project.id)).toBe(only.id);
  });

  it("reports a missing image", async () => {
    expect(await deleteImage(db, randomUUID())).toEqual({ ok: false, reason: "not-found" });
  });
});
