// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/test/db";
import { rateLimits } from "./db/schema";
import { consumeRateLimit } from "./rate-limit";

let db: TestDb;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

const opts = { limit: 3, windowSeconds: 3600 };

describe("consumeRateLimit", () => {
  it("allows attempts up to the limit and blocks the next one", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await consumeRateLimit(db, "t:basic", opts));

    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.count)).toEqual([1, 2, 3, 4]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);
  });

  it("keeps counting blocked attempts, so hammering does not reset anything", async () => {
    for (let i = 0; i < 6; i++) await consumeRateLimit(db, "t:hammer", opts);

    const next = await consumeRateLimit(db, "t:hammer", opts);

    expect(next).toMatchObject({ allowed: false, count: 7 });
  });

  it("tells a blocked caller how long to wait, within the window", async () => {
    for (let i = 0; i < 3; i++) await consumeRateLimit(db, "t:wait", opts);

    const blocked = await consumeRateLimit(db, "t:wait", opts);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(3500);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(3600);
  });

  it("tracks each key separately", async () => {
    for (let i = 0; i < 4; i++) await consumeRateLimit(db, "t:key-a", opts);

    expect((await consumeRateLimit(db, "t:key-b", opts)).allowed).toBe(true);
  });

  it("starts a fresh window once the old one has expired", async () => {
    for (let i = 0; i < 4; i++) await consumeRateLimit(db, "t:expire", opts);
    await db
      .update(rateLimits)
      .set({ windowStart: new Date(Date.now() - 2 * 3600 * 1000) })
      .where(eq(rateLimits.key, "t:expire"));

    const fresh = await consumeRateLimit(db, "t:expire", opts);

    expect(fresh).toMatchObject({ allowed: true, count: 1, remaining: 2 });
  });

  it("does not extend the window while attempts keep arriving inside it", async () => {
    await consumeRateLimit(db, "t:fixed", opts);
    const [before] = await db.select().from(rateLimits).where(eq(rateLimits.key, "t:fixed"));

    await consumeRateLimit(db, "t:fixed", opts);
    const [after] = await db.select().from(rateLimits).where(eq(rateLimits.key, "t:fixed"));

    expect(after!.windowStart.getTime()).toBe(before!.windowStart.getTime());
  });

  it("cannot be raced past the limit by concurrent requests", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => consumeRateLimit(db, "t:race", { limit: 5, windowSeconds: 3600 })),
    );

    expect(results.filter((r) => r.allowed)).toHaveLength(5);
    expect(new Set(results.map((r) => r.count)).size).toBe(20);
  });
});
