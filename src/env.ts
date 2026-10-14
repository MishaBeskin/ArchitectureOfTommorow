import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverSchema = publicSchema.extend({
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres:// connection string"),
  SUPABASE_SECRET_KEY: z.string().min(1),
});

/** A blank line in .env (`KEY=`) means "not set", not an empty value. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

/**
 * Contact form services. All optional so the site builds and runs without them; the contact
 * action decides what a missing service means (dev: skip it, production: refuse to send).
 */
const contactSchema = z.object({
  TURNSTILE_SECRET_KEY: optional(z.string().min(1)),
  RESEND_API_KEY: optional(z.string().min(1)),
  /** Where messages are emailed. Without it they are only stored. */
  CONTACT_TO_EMAIL: optional(z.email()),
  CONTACT_FROM_EMAIL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(3).default("Architecture of Tomorrow <onboarding@resend.dev>"),
  ),
  /** Messages allowed per visitor per hour. */
  CONTACT_RATE_LIMIT_MAX: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().min(1).max(10_000).default(5),
  ),
});

/**
 * The one person allowed into the admin. Required only when the admin is used, so the public site
 * builds and runs without it, but every admin check fails (loudly) until it is set.
 */
const adminSchema = z.object({
  ADMIN_EMAIL: z.email().transform((email) => email.trim().toLowerCase()),
  /** Sign-in attempts allowed per visitor per 15 minutes. */
  ADMIN_LOGIN_RATE_LIMIT_MAX: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().min(1).max(100_000).default(10),
  ),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;
export type ContactEnv = z.infer<typeof contactSchema>;

/** Throws one readable error that names every missing or malformed variable, never its value. */
function parse<T extends z.ZodType>(schema: T, source: Record<string, string | undefined>): z.infer<T> {
  const result = schema.safeParse(source);
  if (result.success) return result.data;
  const problems = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment variables:\n${problems}\nSee .env.example.`);
}

/**
 * Next.js only inlines NEXT_PUBLIC_* when they are referenced literally, so each one is
 * listed here instead of passing process.env wholesale.
 */
export function getPublicEnv(): PublicEnv {
  return parse(publicSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

/** Server only. Includes secrets, so it refuses to run in the browser. */
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() must not be called in the browser.");
  }
  return parse(serverSchema, process.env);
}

export function getContactEnv(): ContactEnv {
  if (typeof window !== "undefined") {
    throw new Error("getContactEnv() must not be called in the browser.");
  }
  return parse(contactSchema, process.env);
}

export function getAdminEnv(): z.infer<typeof adminSchema> {
  if (typeof window !== "undefined") {
    throw new Error("getAdminEnv() must not be called in the browser.");
  }
  return parse(adminSchema, process.env);
}

export { adminSchema, contactSchema, parse as parseEnv, publicSchema, serverSchema };
