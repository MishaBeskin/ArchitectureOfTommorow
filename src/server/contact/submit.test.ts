// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/test/db";
import { contactMessages, rateLimits } from "../db/schema";
import {
  MIN_FILL_MS,
  handleContactSubmission,
  hashIp,
  type ContactDeps,
  type ContactSubmission,
} from "./submit";

let db: TestDb;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.delete(contactMessages);
  await db.delete(rateLimits);
});

const valid = { name: "  Ada Lovelace ", email: " ada@example.com ", message: "  I would like to discuss a project.  " };

function submission(overrides: Partial<ContactSubmission> = {}): ContactSubmission {
  return {
    values: valid,
    honeypot: "",
    elapsedMs: 5_000,
    turnstileToken: "token",
    ip: "203.0.113.9",
    userAgent: "TestAgent/1.0",
    ...overrides,
  };
}

function makeDeps(overrides: Partial<ContactDeps> = {}) {
  const deps = {
    db,
    config: { turnstileSecret: "secret", rateLimitMax: 3, ipHashKey: "hash-key", production: true },
    verifyTurnstile: vi.fn(async ({ token }: { token: string | null }) =>
      token ? ({ success: true } as const) : ({ success: false, reason: "missing-token" } as const),
    ),
    sendEmail: vi.fn(async () => true),
    log: { warn: vi.fn(), error: vi.fn() },
    ...overrides,
  };
  return deps as ContactDeps & {
    verifyTurnstile: ReturnType<typeof vi.fn>;
    sendEmail: ReturnType<typeof vi.fn>;
    log: { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  };
}

const stored = () => db.select().from(contactMessages);

describe("a valid submission", () => {
  it("is stored trimmed, with a hashed IP and the user agent, and reports success", async () => {
    const deps = makeDeps();

    const result = await handleContactSubmission(deps, submission());

    expect(result).toEqual({ status: "success" });
    const [row] = await stored();
    expect(row).toMatchObject({
      name: "Ada Lovelace",
      email: "ada@example.com",
      message: "I would like to discuss a project.",
      userAgent: "TestAgent/1.0",
      handledAt: null,
    });
    expect(row!.ipHash).toBe(hashIp("203.0.113.9", "hash-key"));
    expect(row!.ipHash).not.toContain("203.0.113.9");
  });

  it("verifies the Turnstile token with the visitor's IP", async () => {
    const deps = makeDeps();

    await handleContactSubmission(deps, submission());

    expect(deps.verifyTurnstile).toHaveBeenCalledWith({ secret: "secret", token: "token", ip: "203.0.113.9" });
  });

  it("emails the trimmed message", async () => {
    const deps = makeDeps();

    await handleContactSubmission(deps, submission());

    expect(deps.sendEmail).toHaveBeenCalledWith({
      name: "Ada Lovelace",
      email: "ada@example.com",
      message: "I would like to discuss a project.",
    });
  });

  it("truncates a very long user agent", async () => {
    await handleContactSubmission(makeDeps(), submission({ userAgent: "x".repeat(1000) }));

    expect((await stored())[0]!.userAgent).toHaveLength(300);
  });
});

describe("honeypot", () => {
  it("looks like success to the bot but stores, verifies, emails and counts nothing", async () => {
    const deps = makeDeps();

    const result = await handleContactSubmission(deps, submission({ honeypot: "http://spam.example" }));

    expect(result).toEqual({ status: "success" });
    expect(await stored()).toHaveLength(0);
    expect(await db.select().from(rateLimits)).toHaveLength(0);
    expect(deps.verifyTurnstile).not.toHaveBeenCalled();
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });

  it("treats a whitespace-only value as empty, so a browser autofill glitch does not drop a person", async () => {
    const result = await handleContactSubmission(makeDeps(), submission({ honeypot: "   " }));

    expect(result).toEqual({ status: "success" });
    expect(await stored()).toHaveLength(1);
  });
});

describe("validation", () => {
  it("returns field errors and the entered values, and does nothing else", async () => {
    const deps = makeDeps();
    const values = { name: "", email: "nope", message: "short" };

    const result = await handleContactSubmission(deps, submission({ values }));

    expect(result).toMatchObject({ status: "error", values });
    expect(Object.keys((result as { errors: object }).errors).sort()).toEqual(["email", "message", "name"]);
    expect(await stored()).toHaveLength(0);
    expect(deps.verifyTurnstile).not.toHaveBeenCalled();
    expect(await db.select().from(rateLimits)).toHaveLength(0);
  });
});

describe("fill time", () => {
  it("rejects a submission faster than a person could write it", async () => {
    const deps = makeDeps();

    const result = await handleContactSubmission(deps, submission({ elapsedMs: MIN_FILL_MS - 1 }));

    expect(result).toMatchObject({ status: "error", message: expect.stringContaining("very quick") });
    expect(await stored()).toHaveLength(0);
    expect(deps.verifyTurnstile).not.toHaveBeenCalled();
  });

  it("accepts the minimum time exactly", async () => {
    const result = await handleContactSubmission(makeDeps(), submission({ elapsedMs: MIN_FILL_MS }));

    expect(result).toEqual({ status: "success" });
  });

  it("does not penalise visitors without JavaScript, whose time cannot be measured", async () => {
    const result = await handleContactSubmission(makeDeps(), submission({ elapsedMs: null }));

    expect(result).toEqual({ status: "success" });
  });
});

describe("rate limit", () => {
  it("blocks a visitor after the limit, says when to retry, and stores nothing more", async () => {
    const deps = makeDeps();
    for (let i = 0; i < 3; i++) {
      expect(await handleContactSubmission(deps, submission())).toEqual({ status: "success" });
    }

    const blocked = await handleContactSubmission(deps, submission());

    expect(blocked).toMatchObject({ status: "error", message: expect.stringMatching(/try again in about \d+ minutes?/) });
    expect(await stored()).toHaveLength(3);
    expect(deps.verifyTurnstile).toHaveBeenCalledTimes(3);
  });

  it("limits each visitor separately", async () => {
    const deps = makeDeps();
    for (let i = 0; i < 4; i++) await handleContactSubmission(deps, submission({ ip: "198.51.100.1" }));

    const other = await handleContactSubmission(deps, submission({ ip: "198.51.100.2" }));

    expect(other).toEqual({ status: "success" });
  });

  it("does not count a submission that failed validation against the limit", async () => {
    const deps = makeDeps();
    for (let i = 0; i < 5; i++) {
      await handleContactSubmission(deps, submission({ values: { name: "", email: "", message: "" } }));
    }

    expect(await handleContactSubmission(deps, submission())).toEqual({ status: "success" });
  });
});

describe("Turnstile", () => {
  it("rejects a submission whose check fails, and logs why", async () => {
    const deps = makeDeps({ verifyTurnstile: vi.fn(async () => ({ success: false, reason: "rejected" }) as const) });

    const result = await handleContactSubmission(deps, submission());

    expect(result).toMatchObject({ status: "error", message: expect.stringContaining("verify") });
    expect(await stored()).toHaveLength(0);
    expect(deps.log.warn).toHaveBeenCalledWith("Turnstile verification failed", { reason: "rejected" });
  });

  it("rejects a submission with no token", async () => {
    const result = await handleContactSubmission(makeDeps(), submission({ turnstileToken: null }));

    expect(result).toMatchObject({ status: "error" });
    expect(await stored()).toHaveLength(0);
  });

  it("refuses to accept messages in production when no secret is configured (fails closed)", async () => {
    const deps = makeDeps({
      config: { turnstileSecret: undefined, rateLimitMax: 3, ipHashKey: "k", production: true },
    });

    const result = await handleContactSubmission(deps, submission());

    expect(result).toMatchObject({ status: "error", message: expect.stringContaining("temporarily unavailable") });
    expect(await stored()).toHaveLength(0);
    expect(deps.log.error).toHaveBeenCalled();
  });

  it("skips the check in development when no secret is configured", async () => {
    const deps = makeDeps({
      config: { turnstileSecret: undefined, rateLimitMax: 3, ipHashKey: "k", production: false },
    });

    const result = await handleContactSubmission(deps, submission({ turnstileToken: null }));

    expect(result).toEqual({ status: "success" });
    expect(deps.verifyTurnstile).not.toHaveBeenCalled();
    expect(await stored()).toHaveLength(1);
  });
});

describe("failures after the checks", () => {
  it("reports a storage failure without leaking details, and sends no email", async () => {
    let inserts = 0;
    // The first insert is the rate limiter's; the second is the message itself.
    const flaky = new Proxy(db, {
      get(target, property, receiver) {
        if (property === "insert") {
          return (...args: Parameters<typeof db.insert>) => {
            if (++inserts === 2) throw new Error("connection string leaked: postgres://secret");
            return target.insert(...args);
          };
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const deps = makeDeps({ db: flaky as unknown as TestDb });

    const result = await handleContactSubmission(deps, submission());

    expect(result).toMatchObject({ status: "error", message: expect.stringContaining("went wrong") });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(deps.sendEmail).not.toHaveBeenCalled();
    expect(deps.log.error).toHaveBeenCalled();
  });

  it("still succeeds when the notification email fails, because the message is stored", async () => {
    const deps = makeDeps({ sendEmail: vi.fn(async () => false) });

    const result = await handleContactSubmission(deps, submission());

    expect(result).toEqual({ status: "success" });
    expect(await stored()).toHaveLength(1);
    expect(deps.log.warn).toHaveBeenCalled();
  });

  it("succeeds without sending anything when email is not configured", async () => {
    const result = await handleContactSubmission(makeDeps({ sendEmail: undefined }), submission());

    expect(result).toEqual({ status: "success" });
    expect(await stored()).toHaveLength(1);
  });
});

describe("hashIp", () => {
  it("is stable, hex, and hides the address", () => {
    const hash = hashIp("203.0.113.9", "key");

    expect(hash).toBe(hashIp("203.0.113.9", "key"));
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).not.toContain("203");
  });

  it("differs by address and by key, so hashes cannot be matched across sites", () => {
    expect(hashIp("203.0.113.9", "key")).not.toBe(hashIp("203.0.113.10", "key"));
    expect(hashIp("203.0.113.9", "key")).not.toBe(hashIp("203.0.113.9", "other"));
  });
});
