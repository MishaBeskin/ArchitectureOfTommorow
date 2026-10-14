import { describe, expect, it } from "vitest";
import { checkEnvironment, passes, type Check } from "./checks";

const GOOD = {
  DATABASE_URL: "postgresql://postgres.abc:pw@aws-0-eu.pooler.supabase.com:6543/postgres",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc",
  SUPABASE_SECRET_KEY: "sb_secret_abc",
  ADMIN_EMAIL: "owner@example.com",
  NEXT_PUBLIC_SITE_URL: "https://www.example.com",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAAreal",
  TURNSTILE_SECRET_KEY: "0x4AAAAAAAsecretreal",
  RESEND_API_KEY: "re_abc",
  CONTACT_TO_EMAIL: "owner@example.com",
  CONTACT_FROM_EMAIL: "Studio <hello@example.com>",
};

const find = (checks: Check[], text: string) => checks.find((check) => check.title.includes(text));
const notOk = (checks: Check[]) => checks.filter((check) => check.level !== "ok");

describe("checkEnvironment", () => {
  it("passes a complete, correct production environment with nothing to report", () => {
    const checks = checkEnvironment(GOOD);

    expect(notOk(checks)).toEqual([]);
    expect(passes(checks)).toBe(true);
  });

  it.each(["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "ADMIN_EMAIL"])(
    "fails when %s is missing or blank",
    (name) => {
      for (const value of [undefined, "", "   "]) {
        const checks = checkEnvironment({ ...GOOD, [name]: value });

        expect(find(checks, `${name} is missing`)?.level).toBe("fail");
        expect(passes(checks)).toBe(false);
      }
    },
  );

  it("fails if a secret key was put in a public variable, since every visitor would receive it", () => {
    for (const key of ["sb_secret_abc", "eyJ.service_role.sig"]) {
      const checks = checkEnvironment({ ...GOOD, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key });

      expect(find(checks, "secret key is in NEXT_PUBLIC")?.level).toBe("fail");
    }
  });

  it("fails if the two Supabase keys are swapped the other way", () => {
    const checks = checkEnvironment({ ...GOOD, SUPABASE_SECRET_KEY: "sb_publishable_abc" });

    expect(find(checks, "holds the publishable key")?.level).toBe("fail");
  });

  it("warns when the database string is not the transaction pooler", () => {
    const checks = checkEnvironment({ ...GOOD, DATABASE_URL: "postgresql://postgres:pw@db.abc.supabase.co:5432/postgres" });

    expect(find(checks, "transaction pooler")?.level).toBe("warn");
    expect(passes(checks)).toBe(true);
  });

  it.each(["http://www.example.com", "https://localhost:3000", "http://localhost:3100", "https://127.0.0.1"])(
    "fails when the site address is %s",
    (url) => {
      expect(find(checkEnvironment({ ...GOOD, NEXT_PUBLIC_SITE_URL: url }), "not a live https address")?.level).toBe("fail");
    },
  );

  it("only warns when the site address is unset, since Vercel supplies a fallback", () => {
    const checks = checkEnvironment({ ...GOOD, NEXT_PUBLIC_SITE_URL: undefined });

    expect(find(checks, "NEXT_PUBLIC_SITE_URL is not set")?.level).toBe("warn");
    expect(passes(checks)).toBe(true);
  });

  it("fails without Turnstile keys, because the contact form refuses to send in production", () => {
    for (const missing of ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"]) {
      const checks = checkEnvironment({ ...GOOD, [missing]: "" });

      expect(find(checks, "Turnstile keys are missing")?.level).toBe("fail");
    }
  });

  it.each([
    ["1x00000000000000000000AA", "1x0000000000000000000000000000000AA"],
    ["2x00000000000000000000AB", "2x0000000000000000000000000000000AA"],
    ["3x00000000000000000000FF", "3x0000000000000000000000000000000AA"],
  ])("fails when Turnstile uses Cloudflare's test keys (%s)", (site, secret) => {
    const checks = checkEnvironment({ ...GOOD, NEXT_PUBLIC_TURNSTILE_SITE_KEY: site, TURNSTILE_SECRET_KEY: secret });

    expect(find(checks, "test keys")?.level).toBe("fail");
  });

  it("fails if only one of the two Turnstile keys is a test key", () => {
    const checks = checkEnvironment({ ...GOOD, TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA" });

    expect(find(checks, "test keys")?.level).toBe("fail");
  });

  it("warns, but does not fail, when contact emails are not configured", () => {
    for (const missing of ["RESEND_API_KEY", "CONTACT_TO_EMAIL"]) {
      const checks = checkEnvironment({ ...GOOD, [missing]: undefined });

      expect(find(checks, "will not be emailed")?.level).toBe("warn");
      expect(passes(checks)).toBe(true);
    }
  });

  it("warns when emails would go out from Resend's test sender", () => {
    for (const from of [undefined, "", "Studio <onboarding@resend.dev>"]) {
      expect(find(checkEnvironment({ ...GOOD, CONTACT_FROM_EMAIL: from }), "test address")?.level).toBe("warn");
    }
  });

  it("never puts a secret value in any message", () => {
    const secrets = ["sb_secret_topsecret", "pw-topsecret", "0x4AAAAAAAtopsecret"];
    const checks = checkEnvironment({
      ...GOOD,
      SUPABASE_SECRET_KEY: secrets[0],
      DATABASE_URL: `postgresql://u:${secrets[1]}@h:5432/db`,
      TURNSTILE_SECRET_KEY: secrets[2],
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_leaked-topsecret",
    });

    const text = JSON.stringify(checks);
    for (const value of [...secrets, "leaked-topsecret"]) expect(text).not.toContain(value);
  });

  it("reports an empty environment as many failures rather than throwing", () => {
    const checks = checkEnvironment({});

    expect(checks.filter((check) => check.level === "fail").length).toBeGreaterThanOrEqual(6);
    expect(passes(checks)).toBe(false);
  });
});
