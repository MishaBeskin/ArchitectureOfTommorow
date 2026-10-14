import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverSchema = publicSchema.extend({
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres:// connection string"),
  SUPABASE_SECRET_KEY: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

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

export { parse as parseEnv, publicSchema, serverSchema };
