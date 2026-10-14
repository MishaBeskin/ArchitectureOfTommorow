/**
 * Read-only pre-launch check. It looks at the environment you give it and at the Supabase project
 * behind it, and says what is ready and what is not. It never writes or deletes anything.
 *
 *   pnpm launch:check                          checks .env.local
 *   pnpm launch:check --env-file .env.vercel   checks another file, e.g. one from `vercel env pull`
 *
 * Exits with a failure if anything would break or endanger the live site, so it can gate a deploy.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { SEED_ARCHITECTS, SEED_PREFIX } from "../src/server/seed/data";
import { checkEnvironment, passes, type Check } from "../src/server/launch/checks";

const E2E_EMAILS = ["aot-e2e-admin@example.com", "aot-e2e-visitor@example.com"];

function loadEnvironment(): string {
  const flag = process.argv.indexOf("--env-file");
  const file = flag !== -1 && process.argv[flag + 1] ? process.argv[flag + 1]! : ".env.local";
  process.loadEnvFile(file);
  return file;
}

async function checkSupabase(env: NodeJS.ProcessEnv): Promise<Check[]> {
  const checks: Check[] = [];
  const ok = (title: string) => checks.push({ level: "ok", title });
  const warn = (title: string, detail: string) => checks.push({ level: "warn", title, detail });
  const fail = (title: string, detail: string) => checks.push({ level: "fail", title, detail });

  const url = env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabase = createClient(url, env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Sign-ups: anyone could otherwise create an account (they still could not enter the admin, which
  // is limited to ADMIN_EMAIL, but there is no reason to leave the door open).
  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
    });
    const settings = (await response.json()) as { disable_signup?: boolean };
    if (settings.disable_signup === true) ok("Sign-ups are switched off");
    else
      fail(
        "Sign-ups are still switched on",
        "In Supabase: Authentication > Sign In / Providers > turn off 'Allow new users to sign up', then Save.",
      );
  } catch {
    warn("Could not read the Auth settings", "Check NEXT_PUBLIC_SUPABASE_URL and the publishable key.");
  }

  // Users: exactly one real account, confirmed, with the admin's email; no leftovers from testing.
  const admin = env.ADMIN_EMAIL?.trim().toLowerCase();
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (listError || !list) {
    fail("Could not list the Supabase users", "Check SUPABASE_SECRET_KEY.");
  } else {
    const users = list.users;
    const adminUser = users.find((user) => user.email?.toLowerCase() === admin);
    if (!adminUser) {
      fail(
        "No Supabase user has the ADMIN_EMAIL address",
        "Create it under Authentication > Users > Add user, with 'Auto Confirm' ticked.",
      );
    } else if (!adminUser.email_confirmed_at) {
      fail(
        "The admin user's email is not confirmed",
        "Confirm it in Authentication > Users, or recreate it with 'Auto Confirm' ticked.",
      );
    } else {
      ok("The admin user exists and is confirmed");
    }

    const leftovers = users.filter((user) => E2E_EMAILS.includes(user.email?.toLowerCase() ?? ""));
    if (leftovers.length > 0) {
      fail("Test accounts are left in Supabase", "Delete the aot-e2e-* users under Authentication > Users.");
    }
    const others = users.filter((user) => user.id !== adminUser?.id && !leftovers.includes(user));
    if (others.length > 0) {
      warn(
        `${others.length} other user(s) exist besides the admin`,
        "Only ADMIN_EMAIL can enter the admin, but delete accounts you do not recognise.",
      );
    } else if (leftovers.length === 0) {
      ok("The admin is the only user");
    }
  }

  // Storage bucket: public for reading, limited for writing.
  const { data: bucket } = await supabase.storage.getBucket("projects");
  if (!bucket) {
    fail("The 'projects' storage bucket does not exist", "Create a public bucket named projects (Storage > New bucket).");
  } else {
    if (bucket.public) ok("The projects bucket is public (images can be shown)");
    else fail("The projects bucket is not public", "Images would not show on the site. Make the bucket public.");
    if (bucket.file_size_limit && bucket.allowed_mime_types?.length) ok("The bucket limits upload size and file types");
    else warn("The bucket has no size or type limit", "Set a 30 MB limit and image types only (Storage > projects > Edit bucket).");
  }
  const { data: temp } = await supabase.storage.from("projects").list("tmp", { limit: 5 });
  if (temp && temp.length > 0) {
    warn("Temporary upload files are left in storage", "Folders under tmp/ can be deleted; they are unchecked originals.");
  }

  // Database.
  const db = new Client({ connectionString: env.DATABASE_URL });
  await db.connect();
  try {
    const tables = await db.query<{ tablename: string; rowsecurity: boolean }>(
      "select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename",
    );
    const open = tables.rows.filter((table) => !table.rowsecurity).map((table) => table.tablename);
    if (tables.rows.length === 0) {
      fail("The database has no tables", "Run the migrations: pnpm db:migrate");
    } else if (open.length > 0) {
      fail(
        `Row-level security is off on: ${open.join(", ")}`,
        "Anyone with the public key could read these tables. Enable RLS on them in Supabase.",
      );
    } else {
      ok(`Row-level security is on for all ${tables.rows.length} tables`);
    }

    const journal = JSON.parse(
      readFileSync(path.resolve("src/server/db/migrations/meta/_journal.json"), "utf8"),
    ) as { entries: unknown[] };
    const applied = await db
      .query<{ n: number }>("select count(*)::int as n from drizzle.__drizzle_migrations")
      .catch(() => null);
    if (!applied) {
      fail("No migrations have been applied", "Run the migrations against this database: pnpm db:migrate");
    } else if (applied.rows[0]!.n < journal.entries.length) {
      fail(`Only ${applied.rows[0]!.n} of ${journal.entries.length} migrations are applied`, "Run: pnpm db:migrate");
    } else {
      ok(`All ${journal.entries.length} migration(s) are applied`);
    }

    const content = await db.query<{ slug: string; status: string }>("select slug, status from projects");
    const published = content.rows.filter((row) => row.status === "published");
    const e2e = content.rows.filter((row) => row.slug.startsWith("e2e-"));
    if (e2e.length > 0) {
      fail(`${e2e.length} leftover test project(s) exist`, "Delete the projects whose address starts with e2e- in the admin.");
    }

    // Sample content: recognised by the architects and image paths that only the seed script creates.
    const seedSlugs = SEED_ARCHITECTS.map((architect) => architect.slug);
    const seeded = await db.query<{ n: number }>("select count(*)::int as n from architects where slug = any($1)", [
      seedSlugs,
    ]);
    const imagesFromSeed = await db.query<{ n: number }>(
      "select count(*)::int as n from project_images where pathname like $1",
      [`${SEED_PREFIX}/%`],
    );
    if (seeded.rows[0]!.n > 0 || imagesFromSeed.rows[0]!.n > 0) {
      warn(
        "Sample (fictional) projects and architects are still in the database",
        "They would appear on your live site. When your real projects are ready, remove the samples with: pnpm db:unseed",
      );
    } else {
      ok("No sample content is left");
    }

    if (published.length === 0) {
      warn("No project is published yet", "Visitors would see an empty site. Publish at least one real project.");
    } else {
      ok(`${published.length} project(s) are published`);
    }
  } finally {
    await db.end();
  }

  return checks;
}

const ICON = { ok: "[ok]  ", warn: "[warn]", fail: "[FAIL]" } as const;

function print(check: Check) {
  console.log(`${ICON[check.level]} ${check.title}`);
  if (check.detail) console.log(`         ${check.detail}`);
}

async function main() {
  const file = loadEnvironment();
  console.log(`Checking ${file}\n`);

  const checks = checkEnvironment(process.env);
  console.log("Environment");
  for (const check of checks) print(check);

  const missingBasics = checks.some((check) => check.level === "fail" && /DATABASE_URL|SUPABASE/.test(check.title));
  if (missingBasics) {
    console.log("\nSkipping the Supabase checks until the variables above are fixed.");
  } else {
    console.log("\nSupabase");
    const remote = await checkSupabase(process.env);
    for (const check of remote) print(check);
    checks.push(...remote);
  }

  const failed = checks.filter((check) => check.level === "fail").length;
  const warned = checks.filter((check) => check.level === "warn").length;
  console.log(`\n${failed} problem(s) to fix, ${warned} warning(s).`);
  if (!passes(checks)) process.exitCode = 1;
}

// An async main() instead of top-level await: the package compiles scripts as CommonJS.
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
