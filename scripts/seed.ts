/**
 * Seeds (or with --remove, un-seeds) sample projects and placeholder images.
 * Run through the package scripts so .env.local and the server-only condition are set:
 *   pnpm db:seed      pnpm db:unseed
 */
import { getDb } from "../src/server/db/client";
import { seedDatabase, unseedDatabase } from "../src/server/seed/seed";
import { deleteObjects, listObjects, uploadPublic } from "../src/server/storage";

// An async main() instead of top-level await: the package compiles scripts as CommonJS.
async function main() {
  const db = getDb();

  if (process.argv.includes("--remove")) {
    const result = await unseedDatabase(db, { list: listObjects, remove: deleteObjects });
    console.log(`Removed ${result.projects} sample project(s) and ${result.objects} stored file(s).`);
  } else {
    const result = await seedDatabase(db, uploadPublic);
    console.log(`Seeded ${result.projects} sample project(s) with ${result.images} placeholder image(s).`);
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
