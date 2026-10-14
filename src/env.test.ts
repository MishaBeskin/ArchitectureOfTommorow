import { describe, expect, it } from "vitest";
import { parseEnv, serverSchema } from "./env";

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
