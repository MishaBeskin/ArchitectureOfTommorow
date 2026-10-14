// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/test/db";
import { rateLimits } from "../db/schema";
import type { AuthUserLike } from "./admin";
import { GENERIC_LOGIN_ERROR, handleLogin, type LoginDeps, type LoginInput } from "./login";

let db: TestDb;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.delete(rateLimits);
});

const CONFIRMED = "2025-01-01T00:00:00Z";
const ADMIN = "owner@example.com";
const PASSWORDS: Record<string, { password: string; user: AuthUserLike }> = {
  [ADMIN]: { password: "correct horse", user: { id: "admin-1", email: ADMIN, email_confirmed_at: CONFIRMED } },
  "visitor@example.com": {
    password: "visitor pass",
    user: { id: "visitor-1", email: "visitor@example.com", email_confirmed_at: CONFIRMED },
  },
};

function makeDeps(overrides: Partial<LoginDeps> = {}) {
  const signInWithPassword = vi.fn(async ({ email, password }: { email: string; password: string }) => {
    const account = PASSWORDS[email.toLowerCase()];
    return account && account.password === password
      ? { data: { user: account.user }, error: null }
      : { data: { user: null }, error: new Error("Invalid login credentials") };
  });
  const signOut = vi.fn(async () => ({ error: null }));
  const log = { warn: vi.fn() };
  const deps = {
    db,
    adminEmail: ADMIN,
    rateLimitMax: 3,
    ipHashKey: "hash-key",
    supabase: { auth: { signInWithPassword, signOut } },
    log,
    ...overrides,
  } satisfies LoginDeps;
  return { deps, signInWithPassword, signOut, log };
}

const input = (overrides: Partial<LoginInput> = {}): LoginInput => ({
  email: ADMIN,
  password: "correct horse",
  next: null,
  ip: "203.0.113.9",
  ...overrides,
});

describe("a correct sign-in", () => {
  it("succeeds and goes to the default admin page", async () => {
    const { deps } = makeDeps();

    expect(await handleLogin(deps, input())).toEqual({ status: "success", redirectTo: "/admin/projects" });
  });

  it("returns to the page the visitor was trying to reach, when that is a safe admin path", async () => {
    const { deps } = makeDeps();

    expect(await handleLogin(deps, input({ next: "/admin/projects/42/edit" }))).toEqual({
      status: "success",
      redirectTo: "/admin/projects/42/edit",
    });
  });

  it("ignores an open-redirect attempt in the next parameter", async () => {
    const { deps } = makeDeps({ rateLimitMax: 100 });

    for (const next of ["//evil.example", "https://evil.example", "/\\evil.example", "/admin/../../evil"]) {
      expect(await handleLogin(deps, input({ next })), next).toEqual({ status: "success", redirectTo: "/admin/projects" });
    }
  });

  it("trims the email before asking Supabase", async () => {
    const { deps, signInWithPassword } = makeDeps();

    await handleLogin(deps, input({ email: `  ${ADMIN}  ` }));

    expect(signInWithPassword).toHaveBeenCalledWith({ email: ADMIN, password: "correct horse" });
  });
});

describe("failures", () => {
  it("gives the same answer for a wrong password and for an account that does not exist", async () => {
    const { deps } = makeDeps();

    const wrongPassword = await handleLogin(deps, input({ password: "nope" }));
    const unknownAccount = await handleLogin(deps, input({ email: "ghost@example.com", password: "nope" }));

    expect(wrongPassword).toMatchObject({ status: "error", message: GENERIC_LOGIN_ERROR });
    expect(unknownAccount).toMatchObject({ status: "error", message: GENERIC_LOGIN_ERROR });
  });

  it("gives the generic answer to a correct password for an account that is not the admin, and drops its session", async () => {
    const { deps, signOut, log } = makeDeps();

    const result = await handleLogin(deps, input({ email: "visitor@example.com", password: "visitor pass" }));

    expect(result).toMatchObject({ status: "error", message: GENERIC_LOGIN_ERROR });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(log.warn).toHaveBeenCalled();
  });

  it("does not sign anyone out after a plain wrong password", async () => {
    const { deps, signOut } = makeDeps();

    await handleLogin(deps, input({ password: "nope" }));

    expect(signOut).not.toHaveBeenCalled();
  });

  it("echoes the email back so it need not be retyped", async () => {
    const { deps } = makeDeps();

    expect(await handleLogin(deps, input({ password: "nope" }))).toMatchObject({ email: ADMIN });
  });

  it("refuses empty and oversized input without asking Supabase", async () => {
    const { deps, signInWithPassword } = makeDeps();

    for (const attempt of [
      { email: "", password: "x" },
      { email: "   ", password: "x" },
      { email: ADMIN, password: "" },
      { email: ADMIN, password: "p".repeat(1_001) },
    ]) {
      expect(await handleLogin(deps, input(attempt))).toMatchObject({ status: "error", message: GENERIC_LOGIN_ERROR });
    }
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("never writes a password into the logs", async () => {
    const { deps, log } = makeDeps();

    await handleLogin(deps, input({ email: "visitor@example.com", password: "visitor pass" }));
    await handleLogin(deps, input({ password: "secret-wrong-guess" }));

    expect(JSON.stringify(log.warn.mock.calls)).not.toMatch(/visitor pass|secret-wrong-guess|correct horse/);
  });
});

describe("rate limiting", () => {
  it("blocks a visitor after the limit, even when the password is right, without reaching Supabase", async () => {
    const { deps, signInWithPassword } = makeDeps();
    for (let i = 0; i < 3; i++) await handleLogin(deps, input({ password: "nope" }));
    signInWithPassword.mockClear();

    const blocked = await handleLogin(deps, input());

    expect(blocked).toMatchObject({ status: "error", message: expect.stringMatching(/Too many sign-in attempts.*\d+ minutes?/) });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("counts successful sign-ins too, so the limit cannot be used to probe", async () => {
    const { deps } = makeDeps();
    for (let i = 0; i < 3; i++) expect(await handleLogin(deps, input())).toMatchObject({ status: "success" });

    expect(await handleLogin(deps, input())).toMatchObject({ status: "error", message: expect.stringContaining("Too many") });
  });

  it("limits each visitor separately", async () => {
    const { deps } = makeDeps();
    for (let i = 0; i < 4; i++) await handleLogin(deps, input({ ip: "198.51.100.1", password: "nope" }));

    expect(await handleLogin(deps, input({ ip: "198.51.100.2" }))).toMatchObject({ status: "success" });
  });

  it("also caps attempts across all visitors, so guesses spread over many addresses still stop", async () => {
    const { deps } = makeDeps({ rateLimitMax: 2 }); // global cap is 5x: 10
    const results = [];
    for (let i = 0; i < 12; i++) {
      results.push(await handleLogin(deps, input({ ip: `192.0.2.${i}`, password: "nope" })));
    }

    const blockedFrom = results.findIndex((r) => r.status === "error" && r.message.includes("Too many"));
    expect(blockedFrom).toBe(10);
  });

  it("keeps no raw IP address in the rate-limit table", async () => {
    const { deps } = makeDeps();

    await handleLogin(deps, input({ ip: "203.0.113.9" }));

    const keys = (await db.select().from(rateLimits)).map((row) => row.key);
    expect(keys.some((key) => key.includes("203.0.113.9"))).toBe(false);
    expect(keys.some((key) => /^admin-login:ip:[0-9a-f]{32}$/.test(key))).toBe(true);
  });

  it("does not count empty submissions against the limit", async () => {
    const { deps } = makeDeps();
    for (let i = 0; i < 6; i++) await handleLogin(deps, input({ email: "", password: "" }));

    expect(await handleLogin(deps, input())).toMatchObject({ status: "success" });
  });
});
