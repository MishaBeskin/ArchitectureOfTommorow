"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/server/auth/require-admin";
import { getDb } from "@/server/db/client";
import { handleProjectAction, type ProjectActionState } from "@/server/admin/handle-project-action";
import { deleteObjects } from "@/server/storage";

/**
 * Every button in the projects table posts here. requireAdmin() comes first and is the real
 * check: a server action is a public endpoint that anyone can call, whether or not the page
 * showing its button was ever rendered for them.
 */
export async function projectAction(_previous: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  await requireAdmin();

  try {
    const result = await handleProjectAction(
      {
        db: getDb(),
        removeFiles: deleteObjects,
        // updateTag expires immediately, so the next public visit sees the change (read-your-writes).
        invalidate: (tags) => tags.forEach((tag) => updateTag(tag)),
        log: console,
      },
      { id: formData.get("id"), intent: formData.get("intent") },
    );
    if (result.status === "success") revalidatePath("/admin/projects");
    return result;
  } catch (error) {
    console.error("Project action failed", error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}
