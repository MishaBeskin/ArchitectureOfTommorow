import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ADMIN_STATE, E2E_ADMIN_EMAIL, E2E_VISITOR_EMAIL, signIn } from "./helpers/admin";

// Uses throwaway accounts created by e2e/global-setup.ts, never your own. Skipped when the
// Supabase credentials are not available. Tests that really sign in (and so spend Supabase's
// sign-in rate limit) run only in the desktop project; the mobile project covers layout.

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI supplies the variables directly.
}

const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SECRET_KEY,
);
test.skip(!configured, "needs the Supabase credentials");

const GENERIC_ERROR = "The email or password is incorrect.";
const signedOut = { cookies: [], origins: [] };
const sessionCookies = (page: Page) =>
  page.context().cookies().then((cookies) => cookies.filter((c) => c.name.startsWith("sb-")));
const scan = (page: Page) => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();

test.describe("signed out", () => {
  test.use({ storageState: signedOut });

  test("an admin page redirects to the sign-in page before rendering, remembering where you were going", async ({
    request,
  }) => {
    const response = await request.get("/admin/projects", { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toContain("/admin/login?next=%2Fadmin%2Fprojects");
    expect(await response.text()).not.toContain("Projects");
  });

  test("the admin index redirects too", async ({ request }) => {
    const response = await request.get("/admin", { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toContain("/admin/login?next=%2Fadmin");
  });

  test("every admin response is private, uncacheable and kept out of search results", async ({ request }) => {
    for (const path of ["/admin/login", "/admin/projects"]) {
      const response = await request.get(path, { maxRedirects: 0 });

      expect(response.headers()["x-robots-tag"], path).toContain("noindex");
      expect(response.headers()["cache-control"], path).toContain("no-store");
    }
  });

  test("the sign-in page has a heading, labelled fields and a noindex tag", async ({ page }) => {
    await page.goto("/admin/login");

    await expect(page.getByRole("heading", { level: 1, name: "Admin sign in" })).toBeVisible();
    await expect(page.getByLabel(/Email/)).toBeVisible();
    await expect(page.getByLabel(/Password/)).toHaveAttribute("type", "password");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page).toHaveTitle(/Sign in \| Admin/);
  });

  test("a wrong password shows one generic message, keeps the email and clears the password", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "spends a Supabase sign-in; the desktop project covers it");
    await page.goto("/admin/login");

    await signIn(page, E2E_ADMIN_EMAIL, "definitely-not-the-password");

    const alert = page.getByRole("alert").filter({ hasText: GENERIC_ERROR });
    await expect(alert).toBeVisible();
    await expect(alert).toBeFocused();
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByLabel(/Email/)).toHaveValue(E2E_ADMIN_EMAIL);
    await expect(page.getByLabel(/Password/)).toHaveValue("");
    expect(await sessionCookies(page)).toHaveLength(0);
  });

  test("an account that does not exist gets exactly the same answer as a wrong password", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "spends a Supabase sign-in; the desktop project covers it");
    await page.goto("/admin/login");

    await signIn(page, "nobody-here@example.com", "whatever-password");

    await expect(page.getByRole("alert").filter({ hasText: GENERIC_ERROR })).toBeVisible();
  });

  test("a real account that is not the admin cannot get in, and gets no session", async ({ page, isMobile }) => {
    test.skip(isMobile, "spends a Supabase sign-in; the desktop project covers it");
    await page.goto("/admin/login");

    await signIn(page, E2E_VISITOR_EMAIL, process.env.E2E_VISITOR_PASSWORD!);

    await expect(page.getByRole("alert").filter({ hasText: GENERIC_ERROR })).toBeVisible();
    expect(await sessionCookies(page)).toHaveLength(0);
    const response = await page.request.get("/admin/projects", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
  });

  test("signing in as the admin returns to the page you wanted, with a hardened session cookie", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "spends a Supabase sign-in; the desktop project covers it");
    await page.goto("/admin/projects");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fprojects/);

    await signIn(page, E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD!);

    await expect(page).toHaveURL(/\/admin\/projects$/);
    await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
    await expect(page.getByText(E2E_ADMIN_EMAIL)).toBeVisible();

    const cookies = await sessionCookies(page);
    expect(cookies.length).toBeGreaterThan(0);
    for (const cookie of cookies) {
      expect(cookie.httpOnly, cookie.name).toBe(true);
      expect(cookie.sameSite, cookie.name).toBe("Strict");
    }
    // HttpOnly means a script running in the page cannot read the session.
    expect(await page.evaluate(() => document.cookie)).not.toContain("sb-");
  });

  test("a hostile next parameter cannot send the admin to another site", async ({ page, isMobile }) => {
    test.skip(isMobile, "spends a Supabase sign-in; the desktop project covers it");
    await page.goto("/admin/login?next=//evil.example/phish");

    await signIn(page, E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD!);

    await expect(page).toHaveURL(/localhost:3100\/admin\/projects$/);
  });

  test("signing out ends the session: the cookie is gone and admin pages are closed again", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "spends a Supabase sign-in; the desktop project covers it");
    await page.goto("/admin/login");
    await signIn(page, E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD!);
    await expect(page).toHaveURL(/\/admin\/projects$/);

    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL(/\/admin\/login/);
    expect((await sessionCookies(page)).filter((c) => c.value !== "")).toHaveLength(0);
    const response = await page.request.get("/admin/projects", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
  });

  test("the sign-in page has no detectable accessibility violations, idle or with an error", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/admin/login");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);

    test.skip(isMobile, "the error state needs a Supabase sign-in; the desktop project covers it");
    await signIn(page, E2E_ADMIN_EMAIL, "wrong-password-for-axe");
    await expect(page.getByRole("alert").filter({ hasText: GENERIC_ERROR })).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
  });
});

test.describe("signed in as the admin", () => {
  test.use({ storageState: ADMIN_STATE });

  test("the admin index goes to the projects page", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/admin\/projects$/);
    await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  });

  test("the sign-in page sends an already signed-in admin straight on", async ({ page }) => {
    await page.goto("/admin/login");

    await expect(page).toHaveURL(/\/admin\/projects$/);
  });

  test("the admin shell shows who is signed in, with navigation and a way out", async ({ page }) => {
    await page.goto("/admin/projects");

    await expect(page.getByText(E2E_ADMIN_EMAIL)).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Projects" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await page.getByRole("link", { name: "View site" }).click();
    await expect(page).toHaveURL(`http://localhost:3100/`);
  });

  test("admin pages are noindex and uncacheable", async ({ page, request }) => {
    const response = await request.get("/admin/projects");

    expect(response.status()).toBe(200);
    expect(response.headers()["x-robots-tag"]).toContain("noindex");
    expect(response.headers()["cache-control"]).toContain("no-store");
    await page.goto("/admin/projects");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("the skip link moves focus to the main content", async ({ page }) => {
    await page.goto("/admin/projects");
    // The page streams in behind a loading state; focus must be set once the real page is there.
    await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
  });

  test("has no horizontal scroll", async ({ page }) => {
    await page.goto("/admin/projects");
    await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("has no detectable accessibility violations", async ({ page }) => {
    await page.goto("/admin/projects");
    await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();

    expect((await scan(page)).violations).toEqual([]);
  });
});
