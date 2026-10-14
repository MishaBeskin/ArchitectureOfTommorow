import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getServerEnv } from "@/env";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

// Reused across hot reloads in dev so each reload does not open a new pool.
const globalForDb = globalThis as unknown as { __aotPool?: Pool };

/** Lazy, so importing this module (e.g. during a build) never needs DATABASE_URL. */
let db: Db | undefined;

export function getDb(): Db {
  if (!db) {
    const pool =
      globalForDb.__aotPool ??
      new Pool({
        connectionString: getServerEnv().DATABASE_URL,
        // Supabase's transaction pooler multiplexes connections; keep our side small.
        max: 5,
        idleTimeoutMillis: 10_000,
      });
    if (process.env.NODE_ENV !== "production") globalForDb.__aotPool = pool;
    db = drizzle(pool, { schema });
  }
  return db;
}
