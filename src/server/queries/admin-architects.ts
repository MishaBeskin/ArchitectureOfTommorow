import { asc, eq, sql } from "drizzle-orm";
import { architects } from "../db/schema";
import type { AnyDb } from "../db/types";

export interface AdminArchitectRow {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string | null;
  projectCount: number;
}

/** Every architect with how many projects credit them. Admin only: never cached or public. */
export async function listAdminArchitects(db: AnyDb): Promise<AdminArchitectRow[]> {
  return db
    .select({
      id: architects.id,
      slug: architects.slug,
      name: architects.name,
      websiteUrl: architects.websiteUrl,
      // "architects"."id" is written out in full: interpolating the column prints a bare "id",
      // which could bind to the wrong table inside the subquery.
      projectCount: sql<number>`(select count(*)::int from project_architects where project_architects.architect_id = "architects"."id")`,
    })
    .from(architects)
    .orderBy(asc(architects.name));
}

export async function getArchitectById(db: AnyDb, id: string) {
  const [row] = await db.select().from(architects).where(eq(architects.id, id)).limit(1);
  return row ?? null;
}
