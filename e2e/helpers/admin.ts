import type { Page } from "@playwright/test";

/**
 * Throwaway accounts that exist only while the e2e suite runs (see global-setup.ts). The test
 * server is started with ADMIN_EMAIL set to the first one, so your real admin account is never
 * involved in tests and its password is never needed.
 */
export const E2E_ADMIN_EMAIL = "aot-e2e-admin@example.com";
export const E2E_VISITOR_EMAIL = "aot-e2e-visitor@example.com";

/** A signed-in browser state, created once by global-setup and reused by the signed-in tests. */
export const ADMIN_STATE = "e2e/.auth/admin.json";

/** Fills in and submits the sign-in form. The caller decides where to go first. */
export async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel(/Email/).fill(email);
  await page.getByLabel(/Password/).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
