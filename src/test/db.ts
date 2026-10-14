import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import * as schema from "@/server/db/schema";

/**
 * A throwaway in-process Postgres with the real migrations applied.
 * Each call returns an isolated database, so tests never share state.
 */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, "../server/db/migrations") });
  return { db, close: () => client.close() };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>["db"];

/** Minimal valid project row; override fields per test. */
export function projectValues(overrides: Partial<typeof schema.projects.$inferInsert> = {}) {
  return {
    slug: "the-vertical-forest",
    title: "The Vertical Forest",
    summary: "Two residential towers covered in trees.",
    type: "residential",
    year: 2024,
    city: "Milan",
    countryCode: "IT",
    ...overrides,
  } satisfies typeof schema.projects.$inferInsert;
}
