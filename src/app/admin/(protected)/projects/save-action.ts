"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { formDataToProjectInput } from "@/lib/project-schema";
import { handleSaveProject, type SaveProjectState } from "@/server/admin/handle-save-project";
import { requireAdmin } from "@/server/auth/require-admin";
import { getDb } from "@/server/db/client";

/**
 * The create and edit form posts here. requireAdmin() comes first and is the real check: a server
 * action is a public endpoint that anyone can call, whether or not the form was ever shown to them.
 * A hidden "id" field says which project is being edited; without it a new draft is created.
 */
export async function saveProjectAction(_previous: SaveProjectState, formData: FormData): Promise<SaveProjectState> {
  await requireAdmin();

  let result: SaveProjectState;
  try {
    result = await handleSaveProject(
      {
        db: getDb(),
        // updateTag expires immediately, so the next public visit sees the change (read-your-writes).
        invalidate: (tags) => tags.forEach((tag) => updateTag(tag)),
      },
      { id: formData.get("id"), values: formDataToProjectInput(formData) },
    );
  } catch (error) {
    console.error("Saving a project failed", error);
    return {
      status: "error",
      message: "Something went wrong and nothing was saved. Please try again.",
      errors: {},
      values: formDataToProjectInput(formData),
    };
  }

  if (result.status === "created") {
    revalidatePath("/admin/projects");
    // redirect() works by throwing, so it must stay outside the try block above.
    redirect(`/admin/projects/${result.id}?created=1`);
  }
  if (result.status === "saved") {
    revalidatePath("/admin/projects");
    revalidatePath(`/admin/projects/${result.id}`);
  }
  return result;
}
