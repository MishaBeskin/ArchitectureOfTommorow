import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI supplies the variables directly.
}

const BUCKET = "projects";

function storage() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from(BUCKET);
}

/** Every object path directly inside a folder (these tests never nest deeper). */
export async function listFolder(folder: string): Promise<string[]> {
  const { data, error } = await storage().list(folder, { limit: 1000 });
  if (error) throw new Error(`Listing ${folder} failed: ${error.message}`);
  return (data ?? []).filter((entry) => entry.id).map((entry) => `${folder}/${entry.name}`);
}

/** Removes the files an end-to-end project may have left, so tests never leave storage clutter. */
export async function removeProjectFiles(projectIds: string[]): Promise<void> {
  for (const id of projectIds) {
    const paths = [...(await listFolder(`projects/${id}`)), ...(await listFolder(`tmp/${id}`))];
    if (paths.length > 0) await storage().remove(paths);
  }
}
