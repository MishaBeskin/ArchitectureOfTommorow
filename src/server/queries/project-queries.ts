import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { PAGE_SIZE } from "@/lib/filters";
import {
  PROJECT_TYPES,
  type FilterOptions,
  type Project,
  type ProjectCardData,
  type ProjectFilters,
  type ProjectImage,
} from "@/lib/types";
import * as schema from "../db/schema";
import type { AnyDb } from "../db/types";

/*
 * Plain, uncached data access. Every function takes the database as its first argument so it
 * runs against PGlite in tests; ./projects.ts wraps these with 'use cache' and cache tags.
 * Everything here returns published projects only.
 */

const { projects, projectImages, projectArchitects, architects, projectSlugRedirects } = schema;

const published = eq(projects.status, "published");

type ImageRow = typeof projectImages.$inferSelect;

function toImage(row: ImageRow): ProjectImage {
  return {
    id: row.id,
    url: row.url,
    pathname: row.pathname,
    width: row.width,
    height: row.height,
    alt: row.alt,
    caption: row.caption,
    credit: row.credit,
    blurDataUrl: row.blurDataUrl,
    sortOrder: row.sortOrder,
  };
}

type CardRow = {
  project: typeof projects.$inferSelect;
  cover: ImageRow | null;
};

async function toCards(db: AnyDb, rows: CardRow[]): Promise<ProjectCardData[]> {
  if (rows.length === 0) return [];

  const credits = await db
    .select({ projectId: projectArchitects.projectId, name: architects.name })
    .from(projectArchitects)
    .innerJoin(architects, eq(architects.id, projectArchitects.architectId))
    .where(inArray(projectArchitects.projectId, rows.map((r) => r.project.id)))
    .orderBy(asc(projectArchitects.sortOrder));

  const namesByProject = new Map<string, string[]>();
  for (const credit of credits) {
    namesByProject.set(credit.projectId, [...(namesByProject.get(credit.projectId) ?? []), credit.name]);
  }

  return rows.map(({ project, cover }) => ({
    slug: project.slug,
    title: project.title,
    type: project.type,
    year: project.year,
    location: {
      city: project.city,
      region: project.region,
      countryCode: project.countryCode,
      lat: project.lat,
      lng: project.lng,
    },
    cover: cover ? toImage(cover) : null,
    architectNames: namesByProject.get(project.id) ?? [],
  }));
}

function selectCards(db: AnyDb) {
  return db
    .select({ project: projects, cover: projectImages })
    .from(projects)
    .leftJoin(projectImages, eq(projectImages.id, projects.coverImageId));
}

export async function getFeaturedProjects(db: AnyDb, limit = 6): Promise<ProjectCardData[]> {
  const rows = await selectCards(db)
    .where(and(published, eq(projects.featured, true)))
    .orderBy(sql`${projects.featuredOrder} asc nulls last`, desc(projects.publishedAt))
    .limit(limit);
  return toCards(db, rows);
}

export interface ProjectListResult {
  items: ProjectCardData[];
  total: number;
  /** The page actually returned: a requested page past the end is clamped to the last one. */
  page: number;
  pageCount: number;
}

export async function listProjects(
  db: AnyDb,
  filters: ProjectFilters,
  pageSize = PAGE_SIZE,
): Promise<ProjectListResult> {
  const where = and(
    published,
    filters.type ? eq(projects.type, filters.type) : undefined,
    filters.location ? eq(projects.countryCode, filters.location) : undefined,
    filters.year ? eq(projects.year, filters.year) : undefined,
  );

  const [totalRow] = await db.select({ total: count() }).from(projects).where(where);
  const total = totalRow?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page), pageCount);

  const rows = await selectCards(db)
    .where(where)
    .orderBy(desc(projects.year), desc(projects.publishedAt), asc(projects.title))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { items: await toCards(db, rows), total, page, pageCount };
}

export type ProjectPageResult =
  | { kind: "found"; project: Project }
  | { kind: "redirect"; slug: string }
  | { kind: "not-found" };

/** Resolves a public slug: the project, a redirect from a renamed slug, or not found. */
export async function getProjectPage(db: AnyDb, slug: string): Promise<ProjectPageResult> {
  const [row] = await db
    .select({ project: projects })
    .from(projects)
    .where(and(published, eq(projects.slug, slug)))
    .limit(1);

  if (!row) {
    const [redirect] = await db
      .select({ slug: projects.slug })
      .from(projectSlugRedirects)
      .innerJoin(projects, eq(projects.id, projectSlugRedirects.projectId))
      .where(and(published, eq(projectSlugRedirects.oldSlug, slug)))
      .limit(1);
    return redirect ? { kind: "redirect", slug: redirect.slug } : { kind: "not-found" };
  }

  const { project } = row;
  const [imageRows, creditRows] = await Promise.all([
    db
      .select()
      .from(projectImages)
      .where(eq(projectImages.projectId, project.id))
      .orderBy(asc(projectImages.sortOrder)),
    db
      .select({ architect: architects, role: projectArchitects.role })
      .from(projectArchitects)
      .innerJoin(architects, eq(architects.id, projectArchitects.architectId))
      .where(eq(projectArchitects.projectId, project.id))
      .orderBy(asc(projectArchitects.sortOrder)),
  ]);

  const images = imageRows.map(toImage);

  return {
    kind: "found",
    project: {
      id: project.id,
      slug: project.slug,
      title: project.title,
      summary: project.summary,
      descriptionMd: project.descriptionMd,
      type: project.type,
      phase: project.phase,
      year: project.year,
      location: {
        city: project.city,
        region: project.region,
        countryCode: project.countryCode,
        lat: project.lat,
        lng: project.lng,
      },
      architects: creditRows.map(({ architect, role }) => ({
        id: architect.id,
        slug: architect.slug,
        name: architect.name,
        websiteUrl: architect.websiteUrl,
        bio: architect.bio,
        role,
      })),
      images,
      coverImage: images.find((image) => image.id === project.coverImageId) ?? images[0] ?? null,
      featured: project.featured,
      featuredOrder: project.featuredOrder,
      status: project.status,
      seoTitle: project.seoTitle,
      seoDescription: project.seoDescription,
      publishedAt: project.publishedAt,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
  };
}

/** Only options that exist in published projects, so a filter can never lead to an empty list. */
export async function getFilterOptions(db: AnyDb): Promise<FilterOptions> {
  const [typeRows, locationRows, yearRows] = await Promise.all([
    db.selectDistinct({ type: projects.type }).from(projects).where(published),
    db
      .select({ code: projects.countryCode, count: count() })
      .from(projects)
      .where(published)
      .groupBy(projects.countryCode),
    db.selectDistinct({ year: projects.year }).from(projects).where(published).orderBy(desc(projects.year)),
  ]);

  const present = new Set(typeRows.map((r) => r.type));
  const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

  return {
    // Keep the editorial order from PROJECT_TYPES, not alphabetical or insertion order.
    types: PROJECT_TYPES.filter((type) => present.has(type)),
    locations: locationRows
      .map(({ code, count }) => ({ code, label: regionNames.of(code) ?? code, count }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    years: yearRows.map((r) => r.year),
  };
}

export async function getPublishedSlugs(db: AnyDb): Promise<string[]> {
  const rows = await db.select({ slug: projects.slug }).from(projects).where(published).orderBy(asc(projects.slug));
  return rows.map((r) => r.slug);
}
