import { z } from "zod";
import { PROJECTS_TAG, projectTag } from "@/lib/cache-tags";
import { parseArchitectInput, type ArchitectFieldErrors } from "@/lib/architect-schema";
import type { AnyDb } from "../db/types";
import { createArchitect, deleteArchitect, updateArchitect } from "../mutations/architects";

export type ArchitectFormValues = Record<string, unknown>;

export type SaveArchitectState =
  | { status: "idle" }
  | { status: "created"; id: string; message: string }
  | { status: "saved"; id: string; message: string }
  | { status: "error"; message: string; errors: ArchitectFieldErrors; values: ArchitectFormValues };

export type DeleteArchitectState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export interface ArchitectDeps {
  db: AnyDb;
  /** Expires cached public pages so the change shows up on the next visit. */
  invalidate: (tags: string[]) => void;
}

const idSchema = z.uuid();

/** Creates (no id) or edits (an id) an architect. The caller has already checked the admin. */
export async function handleSaveArchitect(
  deps: ArchitectDeps,
  { id, values }: { id: unknown; values: ArchitectFormValues },
): Promise<SaveArchitectState> {
  const fail = (message: string, errors: ArchitectFieldErrors = {}): SaveArchitectState => ({
    status: "error",
    message,
    errors,
    values,
  });

  const editing = id !== null && id !== undefined && id !== "";
  if (editing && !idSchema.safeParse(id).success) {
    return fail("That request was not valid. Please reload the page and try again.");
  }

  const parsed = parseArchitectInput(values);
  if (!parsed.ok) {
    const count = Object.keys(parsed.errors).length;
    return fail(count === 1 ? "Fix the problem below and save again." : "Fix the problems below and save again.", parsed.errors);
  }

  const taken = {
    slug: "Another architect already uses this web address. Choose a different one.",
  };

  if (!editing) {
    const result = await createArchitect(deps.db, parsed.data);
    if (!result.ok) return fail("Fix the problem below and save again.", taken);
    return { status: "created", id: result.id, message: `"${parsed.data.name}" was added.` };
  }

  const result = await updateArchitect(deps.db, id as string, parsed.data);
  if (!result.ok) {
    return result.reason === "slug-taken"
      ? fail("Fix the problem below and save again.", taken)
      : fail("That architect no longer exists. Go back to the list and try again.");
  }
  // Project pages show the architect's name and website, so those pages must be refreshed.
  deps.invalidate([PROJECTS_TAG, ...result.projectSlugs.map(projectTag)]);
  return { status: "saved", id: result.id, message: `"${result.name}" was saved.` };
}

export async function handleDeleteArchitect(
  deps: ArchitectDeps,
  raw: { id: unknown },
): Promise<DeleteArchitectState> {
  const parsed = idSchema.safeParse(raw.id);
  if (!parsed.success) {
    return { status: "error", message: "That request was not valid. Please reload the page and try again." };
  }

  const result = await deleteArchitect(deps.db, parsed.data);
  if (result.ok) return { status: "success", message: `"${result.name}" was deleted.` };
  if (result.reason === "in-use") {
    const projects = result.projectCount === 1 ? "1 project" : `${result.projectCount} projects`;
    return {
      status: "error",
      message: `"${result.name}" is credited on ${projects}, so it was not deleted. Remove the credit from ${result.projectCount === 1 ? "that project" : "those projects"} first.`,
    };
  }
  return { status: "error", message: "That architect no longer exists. Reload the page to see the current list." };
}
