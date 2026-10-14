import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/env";

export const PROJECT_BUCKET = "projects";

let client: SupabaseClient | undefined;

/** Uses the secret key, so it bypasses storage policies: call only after authorizing the admin. */
function admin(): SupabaseClient {
  if (!client) {
    const env = getServerEnv();
    client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/** Uploads (or overwrites) an object and returns its public URL. */
export async function uploadPublic(pathname: string, data: Buffer, contentType: string): Promise<string> {
  const storage = admin().storage.from(PROJECT_BUCKET);
  const { error } = await storage.upload(pathname, data, { contentType, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`Upload of ${pathname} failed: ${error.message}`);
  return storage.getPublicUrl(pathname).data.publicUrl;
}

export async function deleteObjects(pathnames: string[]): Promise<void> {
  if (pathnames.length === 0) return;
  const { error } = await admin().storage.from(PROJECT_BUCKET).remove(pathnames);
  if (error) throw new Error(`Deleting ${pathnames.length} object(s) failed: ${error.message}`);
}

/** Lists every object path under a prefix, recursing one folder level at a time. */
export async function listObjects(prefix: string): Promise<string[]> {
  const storage = admin().storage.from(PROJECT_BUCKET);
  const found: string[] = [];
  const queue = [prefix.replace(/\/$/, "")];
  while (queue.length > 0) {
    const dir = queue.shift()!;
    const { data, error } = await storage.list(dir, { limit: 1000 });
    if (error) throw new Error(`Listing ${dir} failed: ${error.message}`);
    for (const entry of data ?? []) {
      // Folders come back without an id.
      if (entry.id) found.push(`${dir}/${entry.name}`);
      else queue.push(`${dir}/${entry.name}`);
    }
  }
  return found;
}
