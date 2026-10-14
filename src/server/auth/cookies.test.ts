import { afterEach, describe, expect, it, vi } from "vitest";
import { authCookieOptions } from "./cookies";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("authCookieOptions", () => {
  it("makes the session cookie HttpOnly and strictly same-site, for the whole site", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.example.com");

    expect(authCookieOptions()).toMatchObject({ httpOnly: true, sameSite: "strict", path: "/", secure: true });
  });

  it("only sets Secure when the site is served over https, since plain-http localhost cannot store it", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");

    expect(authCookieOptions()).toMatchObject({ secure: false, httpOnly: true });
  });

  it("keeps Supabase's own settings, such as the lifetime, but never lets them weaken ours", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.example.com");

    const options = authCookieOptions({ maxAge: 400, httpOnly: false, sameSite: "none", secure: false, path: "/x" });

    expect(options).toMatchObject({ maxAge: 400, httpOnly: true, sameSite: "strict", secure: true, path: "/" });
  });
});
