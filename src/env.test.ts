import { describe, expect, it } from "vitest";
import { contactSchema, parseEnv, serverSchema } from "./env";

describe("contact environment", () => {
  it("is fully optional and defaults the sender and the rate limit", () => {
    const env = parseEnv(contactSchema, {});

    expect(env.TURNSTILE_SECRET_KEY).toBeUndefined();
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.CONTACT_TO_EMAIL).toBeUndefined();
    expect(env.CONTACT_FROM_EMAIL).toContain("@");
    expect(env.CONTACT_RATE_LIMIT_MAX).toBe(5);
  });

  it("treats blank values (KEY= in .env) as not set rather than as empty values", () => {
    const env = parseEnv(contactSchema, {
      TURNSTILE_SECRET_KEY: "",
      RESEND_API_KEY: "",
      CONTACT_TO_EMAIL: "",
      CONTACT_FROM_EMAIL: "",
      CONTACT_RATE_LIMIT_MAX: "",
    });

    expect(env.TURNSTILE_SECRET_KEY).toBeUndefined();
    expect(env.CONTACT_TO_EMAIL).toBeUndefined();
    expect(env.CONTACT_RATE_LIMIT_MAX).toBe(5);
  });

  it("reads real values, coercing the rate limit from text", () => {
    const env = parseEnv(contactSchema, {
      TURNSTILE_SECRET_KEY: "s",
      RESEND_API_KEY: "re_x",
      CONTACT_TO_EMAIL: "me@example.com",
      CONTACT_RATE_LIMIT_MAX: "20",
    });

    expect(env).toMatchObject({ TURNSTILE_SECRET_KEY: "s", CONTACT_TO_EMAIL: "me@example.com", CONTACT_RATE_LIMIT_MAX: 20 });
  });

  it("rejects an invalid recipient address or rate limit, naming the variable", () => {
    expect(() => parseEnv(contactSchema, { CONTACT_TO_EMAIL: "not-an-email" })).toThrow(/CONTACT_TO_EMAIL/);
    expect(() => parseEnv(contactSchema, { CONTACT_RATE_LIMIT_MAX: "0" })).toThrow(/CONTACT_RATE_LIMIT_MAX/);
    expect(() => parseEnv(contactSchema, { CONTACT_RATE_LIMIT_MAX: "abc" })).toThrow(/CONTACT_RATE_LIMIT_MAX/);
  });
});

const valid = {
  DATABASE_URL: "postgresql://postgres.abc:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  SUPABASE_SECRET_KEY: "sb_secret_x",
};

describe("environment validation", () => {
  it("accepts a complete, well-formed environment", () => {
    expect(parseEnv(serverSchema, valid)).toEqual(valid);
  });

  it("names every missing variable in one error", () => {
    let message = "";
    try {
      parseEnv(serverSchema, {});
    } catch (error) {
      message = (error as Error).message;
    }

    for (const name of Object.keys(valid)) expect(message).toContain(name);
  });

  it("rejects a DATABASE_URL that is not a postgres connection string", () => {
    expect(() => parseEnv(serverSchema, { ...valid, DATABASE_URL: "mysql://x" })).toThrow(/DATABASE_URL/);
  });

  it("rejects a malformed Supabase URL", () => {
    expect(() => parseEnv(serverSchema, { ...valid, NEXT_PUBLIC_SUPABASE_URL: "not a url" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it("never echoes secret values in the error message", () => {
    const secret = "sb_secret_super_sensitive_value";
    let message = "";
    try {
      parseEnv(serverSchema, { ...valid, DATABASE_URL: `mysql://user:${secret}@host` });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain("DATABASE_URL");
    expect(message).not.toContain(secret);
  });
});
