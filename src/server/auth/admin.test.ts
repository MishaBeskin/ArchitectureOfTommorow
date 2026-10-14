// @vitest-environment node
import { describe, expect, it } from "vitest";
import { adminSchema, parseEnv } from "@/env";
import { getAdminFromClient, isAdminUser, type AuthClientLike, type AuthUserLike } from "./admin";

const CONFIRMED = "2025-01-01T00:00:00Z";
const user = (overrides: Partial<AuthUserLike> = {}): AuthUserLike => ({
  id: "user-1",
  email: "owner@example.com",
  email_confirmed_at: CONFIRMED,
  ...overrides,
});

describe("isAdminUser", () => {
  it("accepts the configured admin with a confirmed email", () => {
    expect(isAdminUser(user(), "owner@example.com")).toBe(true);
  });

  it("ignores case and surrounding whitespace on both sides", () => {
    expect(isAdminUser(user({ email: " Owner@Example.COM " }), "owner@example.com")).toBe(true);
    expect(isAdminUser(user(), "  OWNER@example.com ")).toBe(true);
  });

  it("rejects a different account, even a confirmed one", () => {
    expect(isAdminUser(user({ email: "someone@example.com" }), "owner@example.com")).toBe(false);
  });

  it("rejects look-alike addresses", () => {
    for (const email of ["owner@example.com.evil.test", "xowner@example.com", "owner@example.co", "owner+x@example.com"]) {
      expect(isAdminUser(user({ email }), "owner@example.com"), email).toBe(false);
    }
  });

  it("rejects an account whose email is not confirmed", () => {
    expect(isAdminUser(user({ email_confirmed_at: null }), "owner@example.com")).toBe(false);
    expect(isAdminUser(user({ email_confirmed_at: undefined }), "owner@example.com")).toBe(false);
  });

  it("rejects no user and a user without an email", () => {
    expect(isAdminUser(null, "owner@example.com")).toBe(false);
    expect(isAdminUser(undefined, "owner@example.com")).toBe(false);
    expect(isAdminUser(user({ email: null }), "owner@example.com")).toBe(false);
  });

  it("never matches when no admin email is configured, not even an empty account email", () => {
    expect(isAdminUser(user(), "")).toBe(false);
    expect(isAdminUser(user(), "   ")).toBe(false);
    expect(isAdminUser(user({ email: "" }), "")).toBe(false);
  });
});

function clientReturning(result: { user: AuthUserLike | null; error?: unknown }): AuthClientLike {
  return { auth: { getUser: async () => ({ data: { user: result.user }, error: result.error ?? null }) } };
}

describe("getAdminFromClient", () => {
  it("returns the admin's id and normalised email", async () => {
    const admin = await getAdminFromClient(clientReturning({ user: user({ email: "Owner@Example.com" }) }), "owner@example.com");

    expect(admin).toEqual({ id: "user-1", email: "owner@example.com" });
  });

  it("returns null when Supabase reports an error, even if it also returned a user", async () => {
    const result = await getAdminFromClient(
      clientReturning({ user: user(), error: new Error("invalid JWT") }),
      "owner@example.com",
    );

    expect(result).toBeNull();
  });

  it("returns null when nobody is signed in", async () => {
    expect(await getAdminFromClient(clientReturning({ user: null }), "owner@example.com")).toBeNull();
  });

  it("returns null for a signed-in user who is not the admin", async () => {
    const other = clientReturning({ user: user({ email: "visitor@example.com" }) });

    expect(await getAdminFromClient(other, "owner@example.com")).toBeNull();
  });

  it("asks the Auth server (getUser), never the cookie-only getSession", async () => {
    const calls: string[] = [];
    const client = {
      auth: {
        getUser: async () => {
          calls.push("getUser");
          return { data: { user: null }, error: null };
        },
        getSession: async () => {
          calls.push("getSession");
          return { data: { session: null }, error: null };
        },
      },
    };

    await getAdminFromClient(client, "owner@example.com");

    expect(calls).toEqual(["getUser"]);
  });
});

describe("ADMIN_EMAIL configuration", () => {
  it("is normalised to lower case without surrounding space", () => {
    expect(parseEnv(adminSchema, { ADMIN_EMAIL: "Owner@Example.com" }).ADMIN_EMAIL).toBe("owner@example.com");
  });

  it("is required and must be an email address, naming the variable in the error", () => {
    expect(() => parseEnv(adminSchema, {})).toThrow(/ADMIN_EMAIL/);
    expect(() => parseEnv(adminSchema, { ADMIN_EMAIL: "not-an-email" })).toThrow(/ADMIN_EMAIL/);
    expect(() => parseEnv(adminSchema, { ADMIN_EMAIL: "" })).toThrow(/ADMIN_EMAIL/);
  });
});
