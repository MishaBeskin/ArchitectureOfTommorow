import { chromium, type FullConfig } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { ADMIN_STATE, E2E_ADMIN_EMAIL, E2E_VISITOR_EMAIL, signIn } from "./helpers/admin";

async function removeUser(service: SupabaseClient, email: string) {
  const { data } = await service.auth.admin.listUsers({ perPage: 200 });
  for (const user of data?.users ?? []) {
    if (user.email === email) await service.auth.admin.deleteUser(user.id);
  }
}

async function clearSignInRateLimits() {
  if (!process.env.DATABASE_URL) return;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("delete from rate_limits where key like 'admin-login:%'");
  } finally {
    await client.end();
  }
}

/**
 * Creates the throwaway admin and visitor accounts, signs the admin in once through the real
 * form and saves that session for the signed-in tests (so the suite does not hit Supabase's
 * sign-in rate limit), and returns a teardown that deletes everything it created.
 * Does nothing without Supabase credentials; the admin tests then skip themselves.
 */
export default async function globalSetup(config: FullConfig) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // CI supplies the variables directly.
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return;

  const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const adminPassword = `Pw-${randomUUID()}`;
  const visitorPassword = `Pw-${randomUUID()}`;

  for (const [email, password] of [
    [E2E_ADMIN_EMAIL, adminPassword],
    [E2E_VISITOR_EMAIL, visitorPassword],
  ] as const) {
    await removeUser(service, email); // left over from a run that was interrupted
    const { error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw new Error(`Could not create the e2e user ${email}: ${error.message}`);
  }
  // Environment variables set here are inherited by the test workers.
  process.env.E2E_ADMIN_PASSWORD = adminPassword;
  process.env.E2E_VISITOR_PASSWORD = visitorPassword;

  const baseURL = config.projects[0]!.use.baseURL!;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ baseURL });
    await page.goto("/admin/login");
    await signIn(page, E2E_ADMIN_EMAIL, adminPassword);
    await page.waitForURL("**/admin/projects");
    mkdirSync(path.dirname(ADMIN_STATE), { recursive: true });
    await page.context().storageState({ path: ADMIN_STATE });
  } finally {
    await browser.close();
  }

  return async () => {
    await removeUser(service, E2E_ADMIN_EMAIL);
    await removeUser(service, E2E_VISITOR_EMAIL);
    await clearSignInRateLimits();
  };
}
