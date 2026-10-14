import { asc, desc, eq, sql } from "drizzle-orm";
import type { ProjectStatus, ProjectType } from "@/lib/types";
import { architects, projectArchitects, projectImages, projects } from "../db/schema";
import type { AnyDb } from "../db/types";

export interface AdminProjectRow {
  id: string;
  slug: string;
  title: string;
  status: ProjectStatus;
  type: ProjectType;
  year: number;
  city: string;
  countryCode: string;
  featured: boolean;
  featuredOrder: number | null;
  imageCount: number;
  updatedAt: Date;
  publishedAt: Date | null;
}

/** Every project including drafts, most recently edited first. Admin only: never cached or public. */
export async function listAdminProjects(db: AnyDb): Promise<AdminProjectRow[]> {
  return db
    .select({
      id: projects.id,
      slug: projects.slug,
      title: projects.title,
      status: projects.status,
      type: projects.type,
      year: projects.year,
      city: projects.city,
      countryCode: projects.countryCode,
      featured: projects.featured,
      featuredOrder: projects.featuredOrder,
      // "projects"."id" is written out in full: interpolating the column prints a bare "id", which
      // inside this subquery means project_images.id, so every project would show 0 images.
      imageCount: sql<number>`(select count(*)::int from project_images where project_images.project_id = "projects"."id")`,
      updatedAt: projects.updatedAt,
      publishedAt: projects.publishedAt,
    })
    .from(projects)
    .orderBy(desc(projects.updatedAt), desc(projects.createdAt));
}

export async function getAdminProjectById(db: AnyDb, id: string) {
  const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return row ?? null;
}

export interface ProjectForEdit {
  project: typeof projects.$inferSelect;
  credits: Array<{ architectId: string; role: string | null }>;
  images: Array<typeof projectImages.$inferSelect>;
}

/** Everything the edit form needs, drafts included. Admin only: never cached or public. */
export async function getProjectForEdit(db: AnyDb, id: string): Promise<ProjectForEdit | null> {
  const project = await getAdminProjectById(db, id);
  if (!project) return null;

  const credits = await db
    .select({ architectId: projectArchitects.architectId, role: projectArchitects.role })
    .from(projectArchitects)
    .where(eq(projectArchitects.projectId, id))
    .orderBy(asc(projectArchitects.sortOrder));
  const images = await db
    .select()
    .from(projectImages)
    .where(eq(projectImages.projectId, id))
    .orderBy(asc(projectImages.sortOrder), asc(projectImages.createdAt));

  return { project, credits, images };
}

/** Every architect by name, for the credits picker. */
export async function listArchitectOptions(db: AnyDb): Promise<Array<{ id: string; name: string }>> {
  return db.select({ id: architects.id, name: architects.name }).from(architects).orderBy(asc(architects.name));
}
