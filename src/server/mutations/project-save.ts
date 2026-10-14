import { and, eq, inArray, ne } from "drizzle-orm";
import { publishProblems } from "@/lib/publish-readiness";
import type { ProjectInput } from "@/lib/project-schema";
import type { ProjectStatus } from "@/lib/types";
import { architects, projectArchitects, projectImages, projects, projectSlugRedirects } from "../db/schema";
import type { AnyDb } from "../db/types";

/*
 * Create and edit a project from validated form input (see parseProjectInput). Like the other
 * mutations these know nothing about auth or caching: the server action checks the admin first and
 * expires the public cache tags afterwards, using the slugs returned here.
 */

export type SaveProjectResult =
  | { ok: true; id: string; slug: string; previousSlug: string; status: ProjectStatus }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "slug-taken" }
  | { ok: false; reason: "unknown-architect" }
  | { ok: false; reason: "not-ready"; problems: string[] };

/** A slug is taken if another project uses it now or has used it before (its old address redirects). */
async function slugTaken(tx: AnyDb, slug: string, exceptProjectId?: string): Promise<boolean> {
  const [project] = await tx
    .select({ id: projects.id })
    .from(projects)
    .where(exceptProjectId ? and(eq(projects.slug, slug), ne(projects.id, exceptProjectId)) : eq(projects.slug, slug))
    .limit(1);
  if (project) return true;

  const [redirect] = await tx
    .select({ id: projectSlugRedirects.projectId })
    .from(projectSlugRedirects)
    .where(
      exceptProjectId
        ? and(eq(projectSlugRedirects.oldSlug, slug), ne(projectSlugRedirects.projectId, exceptProjectId))
        : eq(projectSlugRedirects.oldSlug, slug),
    )
    .limit(1);
  return Boolean(redirect);
}

async function allArchitectsExist(tx: AnyDb, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const rows = await tx.select({ id: architects.id }).from(architects).where(inArray(architects.id, ids));
  return rows.length === ids.length;
}

/** Replaces the credits with the given ones, keeping the order the admin chose. */
async function writeCredits(tx: AnyDb, projectId: string, credits: ProjectInput["architects"]) {
  await tx.delete(projectArchitects).where(eq(projectArchitects.projectId, projectId));
  if (credits.length === 0) return;
  await tx.insert(projectArchitects).values(
    credits.map((credit, index) => ({
      projectId,
      architectId: credit.architectId,
      role: credit.role,
      sortOrder: index,
    })),
  );
}

function columns(input: ProjectInput) {
  return {
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    descriptionMd: input.descriptionMd,
    type: input.type,
    phase: input.phase,
    year: input.year,
    city: input.city,
    region: input.region,
    countryCode: input.countryCode,
    lat: input.lat,
    lng: input.lng,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
  };
}

/** New projects always start as drafts; publishing is a separate, checked step. */
export async function createProject(db: AnyDb, input: ProjectInput): Promise<SaveProjectResult> {
  return db.transaction(async (tx) => {
    if (await slugTaken(tx, input.slug)) return { ok: false, reason: "slug-taken" } as const;
    if (!(await allArchitectsExist(tx, input.architects.map((a) => a.architectId)))) {
      return { ok: false, reason: "unknown-architect" } as const;
    }

    const [created] = await tx.insert(projects).values({ ...columns(input), status: "draft" }).returning();
    await writeCredits(tx, created!.id, input.architects);
    return { ok: true, id: created!.id, slug: created!.slug, previousSlug: created!.slug, status: "draft" } as const;
  });
}

/**
 * Saves edits. Renaming the slug leaves a redirect from the old address, so shared links keep
 * working; renaming back removes the redirect that would otherwise point at itself. A published
 * project cannot be edited into a state that breaks the publish rules (for example a blank summary).
 */
export async function updateProject(db: AnyDb, id: string, input: ProjectInput): Promise<SaveProjectResult> {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!current) return { ok: false, reason: "not-found" } as const;

    if (input.slug !== current.slug && (await slugTaken(tx, input.slug, id))) {
      return { ok: false, reason: "slug-taken" } as const;
    }
    if (!(await allArchitectsExist(tx, input.architects.map((a) => a.architectId)))) {
      return { ok: false, reason: "unknown-architect" } as const;
    }

    if (current.status === "published") {
      const images = await tx
        .select({ id: projectImages.id, alt: projectImages.alt })
        .from(projectImages)
        .where(eq(projectImages.projectId, id));
      const problems = publishProblems({ summary: input.summary, coverImageId: current.coverImageId, images });
      if (problems.length > 0) return { ok: false, reason: "not-ready", problems } as const;
    }

    await tx.update(projects).set(columns(input)).where(eq(projects.id, id));

    if (input.slug !== current.slug) {
      await tx
        .delete(projectSlugRedirects)
        .where(and(eq(projectSlugRedirects.oldSlug, input.slug), eq(projectSlugRedirects.projectId, id)));
      await tx
        .insert(projectSlugRedirects)
        .values({ oldSlug: current.slug, projectId: id })
        .onConflictDoNothing();
    }

    await writeCredits(tx, id, input.architects);
    return { ok: true, id, slug: input.slug, previousSlug: current.slug, status: current.status } as const;
  });
}
