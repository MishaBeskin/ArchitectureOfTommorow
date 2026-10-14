import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/**
 * Any Drizzle Postgres database over this schema: node-postgres in the app, PGlite in tests.
 * Query functions accept this so they can be tested without a network database.
 */
export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;
