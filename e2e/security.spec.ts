import { expect, test, type Page } from "@playwright/test";
import { SECURITY_HEADERS } from "../src/lib/csp";
import { ADMIN_STATE } from "./helpers/admin";
import { databaseConfigured, query } from "./helpers/db";

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI supplies the variables directly.
}

const PUBLIC_PAGES = ["/", "/projects", "/projects/harbour-light-library", "/about", "/contact"];
const UUID = "11111111-1111-4111-8111-111111111111";
const ADMIN_PAGES = [
  "/admin",
  "/admin/projects",
  "/admin/projects/new",
  `/admin/projects/${UUID}`,
  "/admin/architects",
  "/admin/architects/new",
  `/admin/architects/${UUID}`,
  "/admin/messages",
];

const directive = (policy: string, name: string) =>
  policy.split("; ").find((d) => d === name || d.startsWith(`${name} `)) ?? "";

/** Records every request the browser's Content Security Policy blocks, from the first byte of the page. */
async function watchViolations(page: Page) {
  const seen: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to/i.test(message.text())) seen.push(message.text());
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __violations: string[] };
    w.__violations = [];
    document.addEventListener("securitypolicyviolation", (event) =>
      w.__violations.push(`${event.violatedDirective}: ${event.blockedURI}`),
    );
  });
  return async () => [
    ...seen,
    ...(await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations)),
  ];
}

test.describe("response headers", () => {
  test("every page carries the standard security headers and does not name its framework", async ({ request }) => {
    for (const path of [...PUBLIC_PAGES, "/admin/login", "/robots.txt", "/sitemap.xml"]) {
      const headers = (await request.get(path)).headers();
      for (const { key, value } of SECURITY_HEADERS) expect(headers[key.toLowerCase()], `${path} ${key}`).toBe(value);
      expect(headers["x-powered-by"], path).toBeUndefined();
    }
  });

  test("public pages get the fixed policy: Turnstile allowed, nothing else third-party", async ({ request }) => {
    for (const path of PUBLIC_PAGES) {
      const policy = (await request.get(path)).headers()["content-security-policy"] ?? "";
      expect(directive(policy, "script-src"), path).toBe(
        "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
      );
      expect(directive(policy, "frame-ancestors"), path).toBe("frame-ancestors 'none'");
      expect(directive(policy, "object-src"), path).toBe("object-src 'none'");
      expect(directive(policy, "frame-src"), path).toBe("frame-src https://challenges.cloudflare.com");
    }
  });

  test("admin pages get their own policy: no third parties, no frames, uploads to Supabase only", async ({ request }) => {
    for (const path of ["/admin/login", "/admin/projects"]) {
      const policy = (await request.get(path, { maxRedirects: 0 })).headers()["content-security-policy"] ?? "";

      expect(directive(policy, "script-src"), path).toBe("script-src 'self' 'unsafe-inline'");
      expect(policy, path).not.toContain("cloudflare");
      expect(directive(policy, "frame-src"), path).toBe("frame-src 'none'");
      expect(directive(policy, "connect-src"), path).toContain(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin);
      expect(directive(policy, "frame-ancestors"), path).toBe("frame-ancestors 'none'");
    }
  });
});

test.describe("the policies do not break the pages", () => {
  for (const path of PUBLIC_PAGES) {
    test(`public ${path} loads with nothing blocked`, async ({ page }) => {
      const violations = await watchViolations(page);
      await page.goto(path);
      if (path === "/contact") {
        // The Turnstile widget is the one third party; the dummy key solves itself.
        await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, { timeout: 20_000 });
      }
      await page.waitForLoadState("load");
      await page.waitForTimeout(500);

      expect(await violations()).toEqual([]);
    });
  }

  test("the sign-in page loads with nothing blocked", async ({ page }) => {
    const violations = await watchViolations(page);
    await page.goto("/admin/login");
    await page.waitForLoadState("load");
      await page.waitForTimeout(500);

    expect(await violations()).toEqual([]);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test.describe("signed in", () => {
    test.use({ storageState: ADMIN_STATE });

    for (const path of [
      "/admin/projects",
      "/admin/projects/new",
      "/admin/architects",
      "/admin/architects/new",
      "/admin/messages",
    ]) {
      test(`admin ${path} loads with nothing blocked, and its scripts run`, async ({ page }) => {
        const violations = await watchViolations(page);
        await page.goto(path);
        await page.waitForLoadState("load");
      await page.waitForTimeout(500);

        // A script blocked by the policy would leave the page unhydrated: interactive controls prove it ran.
        if (path === "/admin/projects/new") {
          await page.getByLabel(/^Title/).fill("Hydration check");
          await expect(page.getByLabel(/^Web address/)).toHaveValue("hydration-check");
        }
        expect(await violations()).toEqual([]);
      });
    }

    test("a project's edit page, with its image manager and blur placeholders, loads with nothing blocked", async ({
      page,
    }) => {
      test.skip(!databaseConfigured, "needs the database");
      const [project] = await query<{ id: string }>("select id from projects where slug = 'unpublished-draft-pavilion'");
      test.skip(!project, "needs the seeded sample projects");

      const violations = await watchViolations(page);
      await page.goto(`/admin/projects/${project!.id}`);
      await expect(page.getByRole("heading", { name: /^Images \(/ })).toBeVisible();
      await page.waitForLoadState("load");
      await page.waitForTimeout(500);
      // Opening the delete confirmation exercises the dialog and its styles.
      await page.getByRole("button", { name: "Delete image 1" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      expect(await violations()).toEqual([]);
    });
  });
});

test.describe("secrets stay on the server", () => {
  test("nothing the browser downloads contains a server secret", async ({ page }) => {
    const secrets = [
      process.env.SUPABASE_SECRET_KEY,
      process.env.DATABASE_URL && decodeURIComponent(new URL(process.env.DATABASE_URL).password),
      process.env.RESEND_API_KEY,
      process.env.TURNSTILE_SECRET_KEY,
    ].filter((value): value is string => Boolean(value) && value!.length > 8);
    expect(secrets.length).toBeGreaterThan(0);

    const bodies: string[] = [];
    page.on("response", async (response) => {
      const type = response.headers()["content-type"] ?? "";
      if (/javascript|html|json/.test(type)) bodies.push(await response.text().catch(() => ""));
    });
    for (const path of [...PUBLIC_PAGES, "/admin/login"]) {
      await page.goto(path);
      await page.waitForLoadState("load");
      await page.waitForTimeout(500);
    }

    expect(bodies.length).toBeGreaterThan(10);
    for (const body of bodies) for (const secret of secrets) expect(body.includes(secret)).toBe(false);
  });
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const path of ADMIN_PAGES) {
    test(`${path} is closed: a real redirect to the sign-in page, before anything renders`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });

      expect(response.status()).toBe(307);
      expect(response.headers().location).toMatch(/^(https?:\/\/[^/]+)?\/admin\/login\?next=/);
      expect(await response.text()).not.toContain("Projects");
    });
  }

  test("the upload route and a forged server-action call give a signed-out visitor nothing", async ({ request }) => {
    const upload = await request.post("/api/admin/upload", {
      data: { projectId: UUID, contentType: "image/jpeg", size: 100 },
    });
    expect(upload.status()).toBe(401);

    // A forged server-action call has no valid action id and no session: it must not succeed.
    const forged = await request.post("/admin/projects", {
      headers: { "Next-Action": "00".repeat(20), "Content-Type": "text/plain;charset=UTF-8" },
      data: "[]",
      maxRedirects: 0,
    });
    expect([307, 400, 404]).toContain(forged.status());
  });
});
