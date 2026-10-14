// @vitest-environment node
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAdminFromClient } from "./admin";

/*
 * Talks to the real Supabase Auth server, so it proves the parts fakes cannot: that a genuine
 * session validates, that a different account is refused, and that a forged token is rejected.
 * It creates throwaway users through the admin API and deletes them afterwards; your own admin
 * account is never touched. Skipped when the Supabase credentials are not available.
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI supplies the variables directly.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const configured = Boolean(url && publishableKey && secretKey);

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const run = randomUUID();
const adminEmail = `aot-test-admin-${run}@example.com`;
const visitorEmail = `aot-test-visitor-${run}@example.com`;
// Supabase hashes passwords with bcrypt, which accepts at most 72 characters.
const password = `Pw-${randomUUID()}`;

describe.skipIf(!configured)("admin check against the real Supabase Auth", () => {
  let service: SupabaseClient;
  const createdIds: string[] = [];

  async function signedInClient(email: string): Promise<SupabaseClient> {
    const client = createClient(url!, publishableKey!, noSession);
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`test sign-in failed: ${error.message}`);
    return client;
  }

  beforeAll(async () => {
    service = createClient(url!, secretKey!, noSession);
    for (const email of [adminEmail, visitorEmail]) {
      const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw new Error(`could not create test user: ${error.message}`);
      createdIds.push(data.user.id);
    }
  }, 60_000);

  afterAll(async () => {
    for (const id of createdIds) await service.auth.admin.deleteUser(id);
  }, 60_000);

  it("accepts a genuine session for the configured admin", async () => {
    const client = await signedInClient(adminEmail);

    const admin = await getAdminFromClient(client, adminEmail);

    expect(admin).toEqual({ id: createdIds[0], email: adminEmail });
  }, 30_000);

  it("refuses a genuine, confirmed session for a different account", async () => {
    const client = await signedInClient(visitorEmail);

    expect(await getAdminFromClient(client, adminEmail)).toBeNull();
  }, 30_000);

  it("refuses the admin's own session when the configured admin is someone else", async () => {
    const client = await signedInClient(adminEmail);

    expect(await getAdminFromClient(client, visitorEmail)).toBeNull();
  }, 30_000);

  it("refuses a client that is not signed in", async () => {
    const client = createClient(url!, publishableKey!, noSession);

    expect(await getAdminFromClient(client, adminEmail)).toBeNull();
  }, 30_000);

  it("refuses a forged or tampered token, because the Auth server verifies it", async () => {
    const real = await signedInClient(adminEmail);
    const { data } = await real.auth.getSession();
    const token = data.session!.access_token;
    const [header, payload, signature] = token.split(".");
    const tampered = `${header}.${payload}.${signature!.slice(0, -4)}AAAA`;
    const garbage = "not.a.jwt";

    for (const jwt of [tampered, garbage]) {
      const client = createClient(url!, publishableKey!, noSession);
      const result = await getAdminFromClient({ auth: { getUser: () => client.auth.getUser(jwt) } }, adminEmail);
      expect(result, jwt.slice(0, 12)).toBeNull();
    }
  }, 30_000);

  it("stops accepting a session once the user is deleted", async () => {
    const email = `aot-test-gone-${run}@example.com`;
    const { data } = await service.auth.admin.createUser({ email, password, email_confirm: true });
    const client = await signedInClient(email);
    expect(await getAdminFromClient(client, email)).not.toBeNull();

    await service.auth.admin.deleteUser(data.user!.id);

    expect(await getAdminFromClient(client, email)).toBeNull();
  }, 30_000);
});
