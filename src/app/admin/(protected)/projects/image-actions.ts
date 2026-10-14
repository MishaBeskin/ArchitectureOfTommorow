"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import {
  handleAttachImage,
  handleImageAction,
  type ImageActionState,
  type ImageDeps,
} from "@/server/admin/handle-image";
import { requireAdmin } from "@/server/auth/require-admin";
import { getDb } from "@/server/db/client";
import { deleteObjects, downloadObject, uploadPublic } from "@/server/storage";

const deps = (): ImageDeps => ({
  db: getDb(),
  storage: { download: downloadObject, upload: uploadPublic, remove: deleteObjects },
  // updateTag expires immediately, so the next public visit sees the change (read-your-writes).
  invalidate: (tags) => tags.forEach((tag) => updateTag(tag)),
  newId: randomUUID,
  log: console,
});

const FAILED: ImageActionState = { status: "error", message: "Something went wrong. Please try again." };

/** Buttons on an image card: save details, move, set cover, delete. requireAdmin() comes first. */
export async function imageAction(_previous: ImageActionState, formData: FormData): Promise<ImageActionState> {
  await requireAdmin();

  try {
    const result = await handleImageAction(deps(), {
      imageId: formData.get("imageId"),
      intent: formData.get("intent"),
      alt: formData.get("alt"),
      caption: formData.get("caption"),
      credit: formData.get("credit"),
    });
    if (result.status === "success") revalidatePath("/admin/projects", "layout");
    return result;
  } catch (error) {
    console.error("Image action failed", error);
    return FAILED;
  }
}

/**
 * Called after the browser has sent an original to its temporary spot: checks it is a real image,
 * re-encodes it and attaches it to the project. requireAdmin() comes first, because a server action
 * is a public endpoint that anyone can call.
 */
export async function attachImageAction(
  projectId: string,
  tempPath: string,
  fields: { alt: string; caption: string; credit: string },
): Promise<ImageActionState> {
  await requireAdmin();

  try {
    const result = await handleAttachImage(deps(), { projectId, tempPath, ...fields });
    if (result.status === "success") revalidatePath("/admin/projects", "layout");
    return result;
  } catch (error) {
    console.error("Attaching an image failed", error);
    return FAILED;
  }
}
