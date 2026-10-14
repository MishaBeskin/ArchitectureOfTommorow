import { and, eq, ne, sql } from "drizzle-orm";
import type { ArchitectInput } from "@/lib/architect-schema";
import { architects, projectArchitects, projects } from "../db/schema";
import type { AnyDb } from "../db/types";

/*
 * Plain, uncached writes for architects. Public project pages show an architect's name and website
 * in the credits, so every result carries the slugs of the credited projects: the server action
 * expires those pages' cache tags after a change.
 */

export type ArchitectResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "slug-taken" }
  | { ok: false; reason: "in-use"; name: string; projectCount: number };

async function creditedProjectSlugs(db: AnyDb, architectId: string): Promise<string[]> {
  const rows = await db
    .select({ slug: projects.slug })
    .from(projectArchitects)
    .innerJoin(projects, eq(projects.id, projectArchitects.projectId))
    .where(eq(projectArchitects.architectId, architectId));
  return rows.map((row) => row.slug);
}

export async function createArchitect(db: AnyDb, input: ArchitectInput): Promise<ArchitectResult<{ id: string }>> {
  const [taken] = await db.select({ id: architects.id }).from(architects).where(eq(architects.slug, input.slug)).limit(1);
  if (taken) return { ok: false, reason: "slug-taken" };

  const [created] = await db.insert(architects).values(input).returning({ id: architects.id });
  return { ok: true, id: created!.id };
}

export async function updateArchitect(
  db: AnyDb,
  id: string,
  input: ArchitectInput,
): Promise<ArchitectResult<{ id: string; name: string; projectSlugs: string[] }>> {
  const [current] = await db.select({ id: architects.id }).from(architects).where(eq(architects.id, id)).limit(1);
  if (!current) return { ok: false, reason: "not-found" };

  const [taken] = await db
    .select({ id: architects.id })
    .from(architects)
    .where(and(eq(architects.slug, input.slug), ne(architects.id, id)))
    .limit(1);
  if (taken) return { ok: false, reason: "slug-taken" };

  await db.update(architects).set(input).where(eq(architects.id, id));
  return { ok: true, id, name: input.name, projectSlugs: await creditedProjectSlugs(db, id) };
}

/** An architect still credited on a project is not deleted: remove the credit first. */
export async function deleteArchitect(db: AnyDb, id: string): Promise<ArchitectResult<{ name: string }>> {
  const [architect] = await db.select().from(architects).where(eq(architects.id, id)).limit(1);
  if (!architect) return { ok: false, reason: "not-found" };

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectArchitects)
    .where(eq(projectArchitects.architectId, id));
  const projectCount = row?.count ?? 0;
  if (projectCount > 0) return { ok: false, reason: "in-use", name: architect.name, projectCount };

  await db.delete(architects).where(eq(architects.id, id));
  return { ok: true, name: architect.name };
}
