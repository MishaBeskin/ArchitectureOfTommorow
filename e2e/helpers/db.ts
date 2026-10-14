import { randomUUID } from "node:crypto";
import { Client } from "pg";

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI supplies the variables directly.
}

export const databaseConfigured = Boolean(process.env.DATABASE_URL);

export async function query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}

export interface ThrowawayProject {
  id: string;
  slug: string;
  title: string;
}

/**
 * Inserts a project straight into the database, so admin tests never touch the seeded samples.
 * `ready` adds the summary, one image with alt text and a cover that the publish rules require.
 * The image row points at a made-up storage path (never a real file), so deleting the project
 * cannot remove one of the sample images even though its URL borrows a real one to display.
 */
export async function createProject({
  ready = true,
  status = "draft",
}: { ready?: boolean; status?: "draft" | "published" } = {}): Promise<ThrowawayProject> {
  const slug = `e2e-${randomUUID().slice(0, 8)}`;
  const title = `E2E Project ${slug.slice(4)}`;

  const [project] = await query<{ id: string }>(
    `insert into projects (slug, title, summary, description_md, type, year, city, country_code, status, published_at)
     values ($1, $2, $3, $4, 'residential', 2024, 'Oslo', 'NO', $5, $6) returning id`,
    [
      slug,
      title,
      "A throwaway project created by the end-to-end tests.",
      "Created by the tests; safe to delete.",
      status,
      status === "published" ? new Date() : null,
    ],
  );

  if (ready) {
    const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/projects/seed/harbour-light-library/1.webp`;
    const [image] = await query<{ id: string }>(
      `insert into project_images (project_id, url, pathname, width, height, alt, blur_data_url, sort_order)
       values ($1, $2, $3, 1600, 1000, 'E2E image', 'data:image/webp;base64,AAAA', 0) returning id`,
      [project!.id, imageUrl, `e2e/${slug}/1.webp`],
    );
    await query("update projects set cover_image_id = $1 where id = $2", [image!.id, project!.id]);
  }

  return { id: project!.id, slug, title };
}

/** Removes throwaway projects (their images cascade). Safe to call for ones already deleted. */
export async function deleteProjects(ids: string[]) {
  if (ids.length > 0) await query("delete from projects where id = any($1::uuid[])", [ids]);
}
