import { createClient } from "@supabase/supabase-js";
import { IMAGE_LIMITS, isImageType } from "./image-rules";

export type UploadOutcome = { ok: true; path: string } | { ok: false; message: string };

/**
 * Sends one original image straight from the browser to storage, via a one-time address from the
 * server (files this size cannot go through a server function). Nothing is public yet: the server
 * checks and re-encodes it next, and only the re-encoded copy is ever shown.
 */
export async function uploadOriginal(projectId: string, file: File): Promise<UploadOutcome> {
  if (!isImageType(file.type)) return { ok: false, message: "Only JPEG, PNG, WebP and AVIF images are accepted." };
  if (file.size > IMAGE_LIMITS.maxBytes) return { ok: false, message: "The file is larger than 30 MB." };
  if (file.size === 0) return { ok: false, message: "The file is empty." };

  let response: Response;
  try {
    response = await fetch("/api/admin/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, contentType: file.type, size: file.size }),
    });
  } catch {
    return { ok: false, message: "Could not reach the server. Check your connection and try again." };
  }

  if (response.status === 401) return { ok: false, message: "Your session has ended. Sign in again and retry." };
  const body = (await response.json().catch(() => null)) as { path?: string; token?: string; error?: string } | null;
  if (!response.ok || !body?.path || !body.token) {
    return { ok: false, message: body?.error ?? "Something went wrong. Please try again." };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await supabase.storage.from("projects").uploadToSignedUrl(body.path, body.token, file, {
    contentType: file.type,
  });
  if (error) return { ok: false, message: "The upload did not finish. Please try again." };

  return { ok: true, path: body.path };
}
