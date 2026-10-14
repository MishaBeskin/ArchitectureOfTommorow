import { sql } from "drizzle-orm";
import { rateLimits } from "./db/schema";
import type { AnyDb } from "./db/types";

export interface RateLimitResult {
  allowed: boolean;
  /** Attempts used in the current window, including this one. */
  count: number;
  remaining: number;
  /** Seconds until the window resets; only meaningful when blocked. */
  retryAfterSeconds: number;
}

/**
 * Fixed-window counter in Postgres. One atomic upsert both counts the attempt and resets an
 * expired window, so concurrent requests cannot slip past the limit with a read-then-write race.
 * Every attempt is counted, including blocked ones.
 */
export async function consumeRateLimit(
  db: AnyDb,
  key: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number },
): Promise<RateLimitResult> {
  const expired = sql`${rateLimits.windowStart} < now() - make_interval(secs => ${windowSeconds})`;

  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
        windowStart: sql`case when ${expired} then now() else ${rateLimits.windowStart} end`,
      },
    })
    .returning({
      count: rateLimits.count,
      resetIn: sql<number>`greatest(0, ceil(extract(epoch from (${rateLimits.windowStart} + make_interval(secs => ${windowSeconds}) - now()))))::int`,
    });

  const count = row?.count ?? 1;
  return {
    allowed: count <= limit,
    count,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: row?.resetIn ?? windowSeconds,
  };
}
