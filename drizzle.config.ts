import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read .env.local itself.
try {
  process.loadEnvFile(".env.local");
} catch {
  // CI or a shell that already exports DATABASE_URL.
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./src/server/db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
