import { asc, eq, sql } from "drizzle-orm";
import { publishProblems } from "@/lib/publish-readiness";
import type { ProjectStatus } from "@/lib/types";
import { projectImages, projects } from "../db/schema";
import type { AnyDb } from "../db/types";

/*
 * Plain, uncached writes for the admin. Each takes the database as its first argument so it runs
 * against PGlite in tests. They know nothing about auth or caching: the server action checks the
 * admin first and invalidates the public cache afterwards.
 */

export type MutationResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "not-ready"; title: string; slug: string; problems: string[] };

/** Publishing is refused until the project passes the publish rules; unpublishing always works. */
export async function setProjectStatus(
  db: AnyDb,
  id: string,
  status: ProjectStatus,
): Promise<MutationResult<{ title: string; slug: string; status: ProjectStatus }>> {
  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!project) return { ok: false, reason: "not-found" };

  if (status === "published") {
    const images = await db
      .select({ id: projectImages.id, alt: projectImages.alt })
      .from(projectImages)
      .where(eq(projectImages.projectId, id))
      .orderBy(asc(projectImages.sortOrder));
    const problems = publishProblems({ summary: project.summary, coverImageId: project.coverImageId, images });
    if (problems.length > 0) {
      return { ok: false, reason: "not-ready", title: project.title, slug: project.slug, problems };
    }
  }

  await db
    .update(projects)
    .set({
      status,
      // The first publication date is kept when a project is unpublished and published again.
      publishedAt: status === "published" ? (project.publishedAt ?? new Date()) : project.publishedAt,
    })
    .where(eq(projects.id, id));

  return { ok: true, title: project.title, slug: project.slug, status };
}

/** A newly featured project goes to the end of the featured order; un-featuring clears its place. */
export async function setProjectFeatured(
  db: AnyDb,
  id: string,
  featured: boolean,
): Promise<MutationResult<{ title: string; slug: string; featured: boolean; status: ProjectStatus }>> {
  return db.transaction(async (tx) => {
    const [project] = await tx.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!project) return { ok: false, reason: "not-found" } as const;

    let featuredOrder: number | null = null;
    if (featured) {
      if (project.featured && project.featuredOrder !== null) {
        featuredOrder = project.featuredOrder;
      } else {
        const [row] = await tx
          .select({ next: sql<number>`coalesce(max(${projects.featuredOrder}), 0) + 1` })
          .from(projects);
        featuredOrder = row?.next ?? 1;
      }
    }

    await tx.update(projects).set({ featured, featuredOrder }).where(eq(projects.id, id));
    return { ok: true, title: project.title, slug: project.slug, featured, status: project.status } as const;
  });
}

/**
 * Deletes the project; its images, credits and slug redirects go with it (cascade). The stored
 * file paths are returned so the caller can remove the files, which live outside the database.
 */
export async function deleteProject(
  db: AnyDb,
  id: string,
): Promise<MutationResult<{ title: string; slug: string; pathnames: string[] }>> {
  return db.transaction(async (tx) => {
    const [project] = await tx.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!project) return { ok: false, reason: "not-found" } as const;

    const images = await tx
      .select({ pathname: projectImages.pathname })
      .from(projectImages)
      .where(eq(projectImages.projectId, id));
    await tx.delete(projects).where(eq(projects.id, id));

    return {
      ok: true,
      title: project.title,
      slug: project.slug,
      pathnames: images.map((image) => image.pathname),
    } as const;
  });
}
