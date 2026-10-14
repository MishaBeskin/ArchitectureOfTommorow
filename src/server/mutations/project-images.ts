import { asc, eq } from "drizzle-orm";
import { IMAGE_LIMITS, type ImageMeta } from "@/lib/image-rules";
import type { ProjectStatus } from "@/lib/types";
import { projectImages, projects } from "../db/schema";
import type { AnyDb } from "../db/types";

/*
 * Plain, uncached writes for a project's images. Each result names the project's slug and status
 * so the server action can expire the right public cache tags. The image files live in storage,
 * outside the database: callers add them before addImage and remove them after deleteImage.
 */

export type ImageResult<T = object> =
  | ({ ok: true; slug: string; status: ProjectStatus } & T)
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "limit" }
  | { ok: false; reason: "last-image" };

export interface NewImage extends ImageMeta {
  id: string;
  url: string;
  pathname: string;
  width: number;
  height: number;
  blurDataUrl: string;
}

async function projectOf(tx: AnyDb, imageId: string) {
  const [row] = await tx
    .select({ image: projectImages, project: projects })
    .from(projectImages)
    .innerJoin(projects, eq(projects.id, projectImages.projectId))
    .where(eq(projectImages.id, imageId))
    .limit(1);
  return row ?? null;
}

/** Appends the image. The first image of a project becomes its cover. */
export async function addImage(db: AnyDb, projectId: string, image: NewImage): Promise<ImageResult<{ id: string }>> {
  return db.transaction(async (tx) => {
    const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) return { ok: false, reason: "not-found" } as const;

    const existing = await tx
      .select({ id: projectImages.id, sortOrder: projectImages.sortOrder })
      .from(projectImages)
      .where(eq(projectImages.projectId, projectId));
    if (existing.length >= IMAGE_LIMITS.perProject) return { ok: false, reason: "limit" } as const;

    const sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
    await tx.insert(projectImages).values({ ...image, projectId, sortOrder });
    if (!project.coverImageId) {
      await tx.update(projects).set({ coverImageId: image.id }).where(eq(projects.id, projectId));
    }
    return { ok: true, id: image.id, slug: project.slug, status: project.status } as const;
  });
}

export async function updateImageMeta(db: AnyDb, imageId: string, meta: ImageMeta): Promise<ImageResult> {
  const found = await projectOf(db, imageId);
  if (!found) return { ok: false, reason: "not-found" };

  await db.update(projectImages).set(meta).where(eq(projectImages.id, imageId));
  return { ok: true, slug: found.project.slug, status: found.project.status };
}

/** Swaps the image with its neighbour; at either end nothing changes. Orders are renumbered 0..n-1. */
export async function moveImage(db: AnyDb, imageId: string, direction: "up" | "down"): Promise<ImageResult> {
  return db.transaction(async (tx) => {
    const found = await projectOf(tx, imageId);
    if (!found) return { ok: false, reason: "not-found" } as const;

    const ordered = await tx
      .select({ id: projectImages.id })
      .from(projectImages)
      .where(eq(projectImages.projectId, found.project.id))
      .orderBy(asc(projectImages.sortOrder), asc(projectImages.createdAt));
    const ids = ordered.map((row) => row.id);
    const from = ids.indexOf(imageId);
    const to = direction === "up" ? from - 1 : from + 1;
    if (to >= 0 && to < ids.length) [ids[from], ids[to]] = [ids[to]!, ids[from]!];

    for (const [index, id] of ids.entries()) {
      await tx.update(projectImages).set({ sortOrder: index }).where(eq(projectImages.id, id));
    }
    return { ok: true, slug: found.project.slug, status: found.project.status } as const;
  });
}

export async function setCoverImage(db: AnyDb, imageId: string): Promise<ImageResult> {
  const found = await projectOf(db, imageId);
  if (!found) return { ok: false, reason: "not-found" };

  await db.update(projects).set({ coverImageId: imageId }).where(eq(projects.id, found.project.id));
  return { ok: true, slug: found.project.slug, status: found.project.status };
}

/**
 * Removes the image row. A deleted cover is replaced by the first remaining image, and a published
 * project keeps at least one image (unpublish it first to remove the last). The stored file's path
 * is returned so the caller can delete the file.
 */
export async function deleteImage(db: AnyDb, imageId: string): Promise<ImageResult<{ pathname: string }>> {
  return db.transaction(async (tx) => {
    const found = await projectOf(tx, imageId);
    if (!found) return { ok: false, reason: "not-found" } as const;
    const { image, project } = found;

    const remaining = await tx
      .select({ id: projectImages.id })
      .from(projectImages)
      .where(eq(projectImages.projectId, project.id))
      .orderBy(asc(projectImages.sortOrder), asc(projectImages.createdAt));
    const others = remaining.filter((row) => row.id !== imageId);
    if (project.status === "published" && others.length === 0) return { ok: false, reason: "last-image" } as const;

    if (project.coverImageId === imageId) {
      await tx.update(projects).set({ coverImageId: others[0]?.id ?? null }).where(eq(projects.id, project.id));
    }
    await tx.delete(projectImages).where(eq(projectImages.id, imageId));
    return { ok: true, slug: project.slug, status: project.status, pathname: image.pathname } as const;
  });
}
