export type CheckLevel = "ok" | "warn" | "fail";

export interface Check {
  level: CheckLevel;
  title: string;
  /** What to do about it, in plain words. Never contains a secret value. */
  detail?: string;
}

type Env = Record<string, string | undefined>;

const set = (value: string | undefined): value is string => typeof value === "string" && value.trim() !== "";

/** Cloudflare's published always-pass / always-fail test keys: right for testing, wrong for a live site. */
const isTurnstileTestKey = (value: string) => /^[123]x0{10,}/.test(value);

/**
 * Judges the environment variables a live deployment needs. A "fail" means the site would be broken
 * or unsafe; a "warn" means it works but something worth fixing is off. Pure: it only looks at the
 * values it is given, so it can be tested and run against any environment file.
 */
export function checkEnvironment(env: Env): Check[] {
  const checks: Check[] = [];
  const ok = (title: string) => checks.push({ level: "ok", title });
  const warn = (title: string, detail: string) => checks.push({ level: "warn", title, detail });
  const fail = (title: string, detail: string) => checks.push({ level: "fail", title, detail });

  // --- Required for the site and the admin to work at all ---
  for (const [name, where] of [
    ["DATABASE_URL", "Supabase > Connect > Transaction pooler"],
    ["NEXT_PUBLIC_SUPABASE_URL", "Supabase > Project Settings > API"],
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "Supabase > Project Settings > API Keys"],
    ["SUPABASE_SECRET_KEY", "Supabase > Project Settings > API Keys > Secret keys"],
    ["ADMIN_EMAIL", "the email of the user you created under Authentication > Users"],
  ] as const) {
    if (set(env[name])) ok(`${name} is set`);
    else fail(`${name} is missing`, `Set it to the value from ${where}.`);
  }

  // --- Keys must not be swapped: a secret key in a NEXT_PUBLIC variable is published to every visitor ---
  const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (set(publishable)) {
    if (/^sb_secret_/.test(publishable) || /service_role/.test(publishable)) {
      fail(
        "A secret key is in NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        "Variables starting with NEXT_PUBLIC_ are sent to every visitor. Put the publishable key here and rotate the secret key in Supabase.",
      );
    } else {
      ok("The public Supabase key is a publishable one");
    }
  }
  const secret = env.SUPABASE_SECRET_KEY;
  if (set(secret) && /^sb_publishable_/.test(secret)) {
    fail("SUPABASE_SECRET_KEY holds the publishable key", "Use the secret key (sb_secret_...) from Project Settings > API Keys.");
  }

  if (set(env.DATABASE_URL)) {
    if (/:6543\//.test(env.DATABASE_URL)) {
      ok("DATABASE_URL uses the transaction pooler (port 6543)");
    } else {
      warn(
        "DATABASE_URL does not look like the transaction pooler",
        "On Vercel each request can open a connection; use the Transaction pooler string (port 6543) so Supabase does not run out of connections.",
      );
    }
  }

  // --- The public address ---
  const site = env.NEXT_PUBLIC_SITE_URL;
  if (!set(site)) {
    warn(
      "NEXT_PUBLIC_SITE_URL is not set",
      "Set it to your real address, for example https://www.example.com. Without it the site guesses from Vercel's own address.",
    );
  } else if (!/^https:\/\//.test(site) || /localhost|127\.0\.0\.1/.test(site)) {
    fail(
      "NEXT_PUBLIC_SITE_URL is not a live https address",
      "Canonical links, the sitemap and search results would point at the wrong place. Use your real https address.",
    );
  } else {
    ok("NEXT_PUBLIC_SITE_URL is an https address");
  }

  // --- Contact form protection ---
  const turnstileSite = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const turnstileSecret = env.TURNSTILE_SECRET_KEY;
  if (!set(turnstileSite) || !set(turnstileSecret)) {
    fail(
      "Turnstile keys are missing",
      "The contact form refuses messages in production without them. Create a Turnstile widget at dash.cloudflare.com and set NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY.",
    );
  } else if (isTurnstileTestKey(turnstileSite) || isTurnstileTestKey(turnstileSecret)) {
    fail(
      "Turnstile is using Cloudflare's test keys",
      "Test keys let every robot through. Create a real widget for your domain and use its two keys.",
    );
  } else {
    ok("Turnstile keys are set and are not test keys");
  }

  // --- Contact email: optional, messages are always stored ---
  if (!set(env.RESEND_API_KEY) || !set(env.CONTACT_TO_EMAIL)) {
    warn(
      "Contact messages will not be emailed",
      "They are still saved in the admin Messages page. To also get an email, set RESEND_API_KEY and CONTACT_TO_EMAIL.",
    );
  } else {
    ok("Contact emails are configured");
    if (!set(env.CONTACT_FROM_EMAIL) || /resend\.dev/i.test(env.CONTACT_FROM_EMAIL)) {
      warn(
        "The email sender is Resend's test address",
        "It only delivers to your own Resend account. Verify your domain in Resend and set CONTACT_FROM_EMAIL to an address on it.",
      );
    } else {
      ok("The email sender is a custom address");
    }
  }

  return checks;
}

/** True when nothing failed (warnings are allowed). */
export const passes = (checks: Check[]) => checks.every((check) => check.level !== "fail");
