import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS, adminCsp, publicCsp } from "./csp";

const SUPABASE = "https://abc.supabase.co";
const directive = (policy: string, name: string) =>
  policy.split("; ").find((d) => d === name || d.startsWith(`${name} `));

describe("publicCsp", () => {
  const policy = publicCsp({ supabaseOrigin: SUPABASE, https: true });

  it("allows scripts only from this site and Turnstile, and no eval in production", () => {
    expect(directive(policy, "script-src")).toBe("script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com");
    expect(policy).not.toContain("unsafe-eval");
  });

  it("lets the Turnstile widget frame and connect, and nothing else", () => {
    expect(directive(policy, "frame-src")).toBe("frame-src https://challenges.cloudflare.com");
    expect(directive(policy, "connect-src")).toBe("connect-src 'self' https://challenges.cloudflare.com");
  });

  it("allows images from this site, data and blob URLs and the Supabase project only", () => {
    expect(directive(policy, "img-src")).toBe(`img-src 'self' data: blob: ${SUPABASE}`);
  });

  it("forbids plugins, framing, base-tag changes and cross-site form posts", () => {
    for (const expected of [
      "default-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ]) {
      expect(directive(policy, expected.split(" ")[0]!)).toBe(expected);
    }
  });

  it("upgrades insecure requests only over https, and allows eval only in development", () => {
    expect(policy).toContain("upgrade-insecure-requests");
    expect(publicCsp({ https: false })).not.toContain("upgrade-insecure-requests");
    expect(directive(publicCsp({ https: false, dev: true }), "script-src")).toContain("'unsafe-eval'");
  });

  it("works without a Supabase origin", () => {
    expect(directive(publicCsp({ https: true }), "img-src")).toBe("img-src 'self' data: blob:");
  });
});

describe("adminCsp", () => {
  const policy = adminCsp({ supabaseOrigin: SUPABASE, https: true });

  it("allows scripts only from this site, with no third party at all", () => {
    expect(directive(policy, "script-src")).toBe("script-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain("cloudflare");
  });

  it("allows no frames, and connections only to this site and Supabase (for uploads)", () => {
    expect(directive(policy, "frame-src")).toBe("frame-src 'none'");
    expect(directive(policy, "connect-src")).toBe(`connect-src 'self' ${SUPABASE}`);
    expect(directive(policy, "img-src")).toBe(`img-src 'self' data: blob: ${SUPABASE}`);
  });

  it("keeps the shared lock-downs", () => {
    expect(directive(policy, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(policy, "object-src")).toBe("object-src 'none'");
    expect(directive(policy, "base-uri")).toBe("base-uri 'self'");
    expect(directive(policy, "form-action")).toBe("form-action 'self'");
  });

  it("relaxes only what development needs", () => {
    const dev = adminCsp({ https: false, dev: true });

    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
    expect(adminCsp({ https: true })).not.toContain("unsafe-eval");
  });
});

describe("SECURITY_HEADERS", () => {
  const byKey = Object.fromEntries(SECURITY_HEADERS.map((h) => [h.key, h.value]));

  it("includes the standard protections", () => {
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(byKey["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(byKey["Strict-Transport-Security"]).toMatch(/^max-age=\d{8,}; includeSubDomains$/);
  });

  it("switches off powerful features nothing here uses", () => {
    for (const feature of ["camera=()", "microphone=()", "geolocation=()"]) {
      expect(byKey["Permissions-Policy"]).toContain(feature);
    }
  });

  it("has no duplicate headers and no Content-Security-Policy (that differs by route)", () => {
    expect(new Set(SECURITY_HEADERS.map((h) => h.key)).size).toBe(SECURITY_HEADERS.length);
    expect(byKey["Content-Security-Policy"]).toBeUndefined();
  });
});
