import { and, eq, inArray, notExists } from "drizzle-orm";
import * as schema from "../db/schema";
import type { AnyDb } from "../db/types";
import { SEED_ARCHITECTS, SEED_PREFIX, SEED_PROJECTS, type SeedArchitect, type SeedProject } from "./data";
import { makePlaceholderImage, type PlaceholderImage } from "./placeholder-image";

export type Uploader = (pathname: string, data: Buffer, contentType: string) => Promise<string>;

export interface SeedSummary {
  projects: number;
  images: number;
}

/**
 * Idempotent: each seed project is deleted (cascading to its images and credits) and recreated,
 * and its images are overwritten in storage, so running it twice leaves the same data.
 */
export async function seedDatabase(
  db: AnyDb,
  upload: Uploader,
  projects: SeedProject[] = SEED_PROJECTS,
  architects: SeedArchitect[] = SEED_ARCHITECTS,
): Promise<SeedSummary> {
  await db
    .insert(schema.architects)
    .values(architects.map(({ slug, name, websiteUrl }) => ({ slug, name, websiteUrl })))
    .onConflictDoUpdate({
      target: schema.architects.slug,
      set: { name: schema.architects.name },
    });

  const rows = await db
    .select({ id: schema.architects.id, slug: schema.architects.slug })
    .from(schema.architects)
    .where(inArray(schema.architects.slug, architects.map((a) => a.slug)));
  const architectIds = new Map(rows.map((r) => [r.slug, r.id]));

  let imageTotal = 0;

  for (const project of projects) {
    // Upload first: network work stays outside the database transaction.
    const images: Array<PlaceholderImage & { pathname: string; url: string; index: number }> = [];
    for (let index = 0; index < project.imageCount; index++) {
      const image = await makePlaceholderImage(project.slug, index);
      const pathname = `${SEED_PREFIX}/${project.slug}/${index + 1}.webp`;
      const url = await upload(pathname, image.data, "image/webp");
      images.push({ ...image, pathname, url, index });
    }

    await db.transaction(async (tx) => {
      await tx.delete(schema.projects).where(eq(schema.projects.slug, project.slug));

      const [created] = await tx
        .insert(schema.projects)
        .values({
          slug: project.slug,
          title: project.title,
          summary: project.summary,
          descriptionMd: project.descriptionMd,
          type: project.type,
          phase: project.phase,
          status: project.status,
          year: project.year,
          city: project.city,
          region: project.region,
          countryCode: project.countryCode,
          lat: project.lat,
          lng: project.lng,
          featured: project.featured ?? false,
          featuredOrder: project.featuredOrder,
          publishedAt: project.status === "published" ? new Date() : null,
        })
        .returning({ id: schema.projects.id });
      const projectId = created!.id;

      const inserted = await tx
        .insert(schema.projectImages)
        .values(
          images.map((image) => ({
            projectId,
            url: image.url,
            pathname: image.pathname,
            width: image.width,
            height: image.height,
            alt: `Placeholder rendering ${image.index + 1} of ${project.title}`,
            caption: image.index === 0 ? "Placeholder image for development" : null,
            blurDataUrl: image.blurDataUrl,
            sortOrder: image.index,
          })),
        )
        .returning({ id: schema.projectImages.id, sortOrder: schema.projectImages.sortOrder });

      const cover = inserted.find((row) => row.sortOrder === 0);
      if (cover) {
        await tx.update(schema.projects).set({ coverImageId: cover.id }).where(eq(schema.projects.id, projectId));
      }

      await tx.insert(schema.projectArchitects).values(
        project.architects.map((credit, sortOrder) => ({
          projectId,
          architectId: architectIds.get(credit.slug)!,
          role: credit.role,
          sortOrder,
        })),
      );
    });

    imageTotal += images.length;
  }

  return { projects: projects.length, images: imageTotal };
}

/** Removes only seeded data: seed slugs, their architects (if unused elsewhere) and `seed/` files. */
export async function unseedDatabase(
  db: AnyDb,
  storage: { list: (prefix: string) => Promise<string[]>; remove: (paths: string[]) => Promise<void> },
  projects: SeedProject[] = SEED_PROJECTS,
  architects: SeedArchitect[] = SEED_ARCHITECTS,
): Promise<{ projects: number; objects: number }> {
  const removed = await db
    .delete(schema.projects)
    .where(inArray(schema.projects.slug, projects.map((p) => p.slug)))
    .returning({ id: schema.projects.id });

  // Only delete architects no remaining project credits; the FK is `restrict` on purpose.
  await db.delete(schema.architects).where(
    and(
      inArray(schema.architects.slug, architects.map((a) => a.slug)),
      notExists(
        db
          .select({ one: schema.projectArchitects.projectId })
          .from(schema.projectArchitects)
          .where(eq(schema.projectArchitects.architectId, schema.architects.id)),
      ),
    ),
  );

  const objects = await storage.list(SEED_PREFIX);
  await storage.remove(objects);

  return { projects: removed.length, objects: objects.length };
}
