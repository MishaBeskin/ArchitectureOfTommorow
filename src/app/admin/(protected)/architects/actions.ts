"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { formDataToArchitectInput } from "@/lib/architect-schema";
import {
  handleDeleteArchitect,
  handleSaveArchitect,
  type DeleteArchitectState,
  type SaveArchitectState,
} from "@/server/admin/handle-architect";
import { requireAdmin } from "@/server/auth/require-admin";
import { getDb } from "@/server/db/client";

// updateTag expires immediately, so the next public visit sees the change (read-your-writes).
const deps = () => ({ db: getDb(), invalidate: (tags: string[]) => tags.forEach((tag) => updateTag(tag)) });

/**
 * The architect form posts here. requireAdmin() comes first and is the real check: a server action
 * is a public endpoint that anyone can call. A hidden "id" field means edit; without it, add.
 */
export async function saveArchitectAction(
  _previous: SaveArchitectState,
  formData: FormData,
): Promise<SaveArchitectState> {
  await requireAdmin();

  let result: SaveArchitectState;
  try {
    result = await handleSaveArchitect(deps(), { id: formData.get("id"), values: formDataToArchitectInput(formData) });
  } catch (error) {
    console.error("Saving an architect failed", error);
    return {
      status: "error",
      message: "Something went wrong and nothing was saved. Please try again.",
      errors: {},
      values: formDataToArchitectInput(formData),
    };
  }

  if (result.status === "created") {
    revalidatePath("/admin/architects");
    // redirect() works by throwing, so it must stay outside the try block above.
    redirect(`/admin/architects/${result.id}?created=1`);
  }
  if (result.status === "saved") {
    revalidatePath("/admin/architects");
    revalidatePath(`/admin/architects/${result.id}`);
    // The project form lists architects, so its pages must not show a stale name.
    revalidatePath("/admin/projects", "layout");
  }
  return result;
}

export async function deleteArchitectAction(
  _previous: DeleteArchitectState,
  formData: FormData,
): Promise<DeleteArchitectState> {
  await requireAdmin();

  try {
    const result = await handleDeleteArchitect(deps(), { id: formData.get("id") });
    if (result.status === "success") {
      revalidatePath("/admin/architects");
      revalidatePath("/admin/projects", "layout");
    }
    return result;
  } catch (error) {
    console.error("Deleting an architect failed", error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}
