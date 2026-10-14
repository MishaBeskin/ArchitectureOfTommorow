import { z } from "zod";
import { PROJECTS_TAG, projectTag } from "@/lib/cache-tags";
import {
  imagePath,
  parseImageMeta,
  parseTempPath,
  type ImageMetaErrors,
} from "@/lib/image-rules";
import type { AnyDb } from "../db/types";
import { ImageRejected, processImage } from "../images/process-image";
import { addImage, deleteImage, moveImage, setCoverImage, updateImageMeta, type ImageResult } from "../mutations/project-images";

export type ImageActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; imageId?: string; errors?: ImageMetaErrors };

export interface ImageDeps {
  db: AnyDb;
  storage: {
    download: (path: string) => Promise<Buffer>;
    upload: (path: string, data: Buffer, contentType: string) => Promise<string>;
    remove: (paths: string[]) => Promise<void>;
  };
  /** Expires cached public pages so the change shows up on the next visit. */
  invalidate: (tags: string[]) => void;
  newId: () => string;
  log: { warn: (message: string, meta?: unknown) => void };
}

const uuid = z.uuid();
const error = (message: string, extra: { imageId?: string; errors?: ImageMetaErrors } = {}): ImageActionState => ({
  status: "error",
  message,
  ...extra,
});

const expire = (deps: ImageDeps, slug: string) => deps.invalidate([PROJECTS_TAG, projectTag(slug)]);

/** Removes files, never failing the caller: a stray file is harmless, a failed request is not. */
async function removeQuietly(deps: ImageDeps, paths: string[]) {
  try {
    await deps.storage.remove(paths);
  } catch (cause) {
    deps.log.warn("Could not remove stored files", { paths, cause });
  }
}

const failureMessage = (result: Extract<ImageResult, { ok: false }>): string => {
  switch (result.reason) {
    case "not-found":
      return "That image or project no longer exists. Reload the page and try again.";
    case "limit":
      return "This project already has the most images allowed. Delete one first.";
    case "last-image":
      return "A published project needs at least one image. Unpublish it first to remove the last one.";
  }
};

/**
 * The browser has put the original at a temporary path; this checks it is a real image, re-encodes
 * it, stores the result and records it. The temporary original is always removed afterwards.
 * Caller has checked the admin.
 */
export async function handleAttachImage(
  deps: ImageDeps,
  raw: { projectId: unknown; tempPath: unknown; alt: unknown; caption: unknown; credit: unknown },
): Promise<ImageActionState> {
  const projectId = uuid.safeParse(raw.projectId);
  const temp = typeof raw.tempPath === "string" ? parseTempPath(raw.tempPath) : null;
  // Only a path that is exactly tmp/<this project>/<id> is ever touched, so this cannot be pointed
  // at another project's files.
  if (!projectId.success || !temp || temp.projectId !== projectId.data) {
    return error("That upload was not valid. Please try again.");
  }
  const tempPath = raw.tempPath as string;

  const meta = parseImageMeta({ alt: raw.alt, caption: raw.caption, credit: raw.credit });
  if (!meta.ok) {
    await removeQuietly(deps, [tempPath]);
    return error("Fix the problem below and upload again.", { errors: meta.errors });
  }

  let finalPath: string | null = null;
  try {
    const original = await deps.storage.download(tempPath);
    const processed = await processImage(original);

    const id = deps.newId();
    finalPath = imagePath(projectId.data, id);
    const url = await deps.storage.upload(finalPath, processed.data, "image/webp");

    const result = await addImage(deps.db, projectId.data, {
      id,
      url,
      pathname: finalPath,
      width: processed.width,
      height: processed.height,
      blurDataUrl: processed.blurDataUrl,
      ...meta.data,
    });
    if (!result.ok) {
      await removeQuietly(deps, [finalPath]);
      return error(failureMessage(result));
    }

    expire(deps, result.slug);
    return { status: "success", message: "The image was added." };
  } catch (cause) {
    if (cause instanceof ImageRejected) return error(cause.message);
    if (finalPath) await removeQuietly(deps, [finalPath]);
    throw cause;
  } finally {
    await removeQuietly(deps, [tempPath]);
  }
}

const imageActionSchema = z.object({
  imageId: z.uuid(),
  intent: z.enum(["save", "up", "down", "cover", "delete"]),
});

/** One handler for every button on an image card. The caller has checked the admin. */
export async function handleImageAction(
  deps: ImageDeps,
  raw: { imageId: unknown; intent: unknown; alt: unknown; caption: unknown; credit: unknown },
): Promise<ImageActionState> {
  const parsed = imageActionSchema.safeParse({ imageId: raw.imageId, intent: raw.intent });
  if (!parsed.success) return error("That request was not valid. Please reload the page and try again.");
  const { imageId, intent } = parsed.data;

  if (intent === "save") {
    const meta = parseImageMeta({ alt: raw.alt, caption: raw.caption, credit: raw.credit });
    if (!meta.ok) return error("Fix the problem below and save again.", { imageId, errors: meta.errors });
    const result = await updateImageMeta(deps.db, imageId, meta.data);
    if (!result.ok) return error(failureMessage(result));
    expire(deps, result.slug);
    return { status: "success", message: "The image details were saved." };
  }

  if (intent === "up" || intent === "down") {
    const result = await moveImage(deps.db, imageId, intent);
    if (!result.ok) return error(failureMessage(result));
    expire(deps, result.slug);
    return { status: "success", message: intent === "up" ? "The image moved up." : "The image moved down." };
  }

  if (intent === "cover") {
    const result = await setCoverImage(deps.db, imageId);
    if (!result.ok) return error(failureMessage(result));
    expire(deps, result.slug);
    return { status: "success", message: "This image is now the cover." };
  }

  const result = await deleteImage(deps.db, imageId);
  if (!result.ok) return error(failureMessage(result));
  expire(deps, result.slug);
  await removeQuietly(deps, [result.pathname]);
  return { status: "success", message: "The image was deleted." };
}
