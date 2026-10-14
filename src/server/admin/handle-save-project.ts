import { z } from "zod";
import { PROJECTS_TAG, projectTag } from "@/lib/cache-tags";
import { parseProjectInput, type ProjectFieldErrors } from "@/lib/project-schema";
import type { AnyDb } from "../db/types";
import { createProject, updateProject } from "../mutations/project-save";

/** The form's fields as typed, kept so a failed save can show the admin's text again. */
export type ProjectFormValues = Record<string, unknown>;

export type SaveProjectState =
  | { status: "idle" }
  | { status: "created"; id: string; message: string }
  | { status: "saved"; id: string; message: string }
  | {
      status: "error";
      message: string;
      errors: ProjectFieldErrors;
      problems?: string[];
      values: ProjectFormValues;
    };

export interface SaveProjectDeps {
  db: AnyDb;
  /** Expires cached public pages so the change shows up on the next visit. */
  invalidate: (tags: string[]) => void;
}

const idSchema = z.uuid();

/**
 * Creates (no id) or edits (an id) a project from the form. The caller has already checked that
 * the user is the admin. Input is validated here, on the server, whatever the browser did.
 */
export async function handleSaveProject(
  deps: SaveProjectDeps,
  { id, values }: { id: unknown; values: ProjectFormValues },
): Promise<SaveProjectState> {
  const fail = (message: string, errors: ProjectFieldErrors = {}, problems?: string[]): SaveProjectState => ({
    status: "error",
    message,
    errors,
    problems,
    values,
  });

  const editing = id !== null && id !== undefined && id !== "";
  if (editing && !idSchema.safeParse(id).success) {
    return fail("That request was not valid. Please reload the page and try again.");
  }

  const parsed = parseProjectInput(values);
  if (!parsed.ok) {
    const count = Object.keys(parsed.errors).length;
    return fail(count === 1 ? "Fix the problem below and save again." : "Fix the problems below and save again.", parsed.errors);
  }

  const result = editing ? await updateProject(deps.db, id as string, parsed.data) : await createProject(deps.db, parsed.data);

  if (!result.ok) {
    switch (result.reason) {
      case "not-found":
        return fail("That project no longer exists. Go back to the list and try again.");
      case "slug-taken":
        return fail("Fix the problem below and save again.", {
          slug: "Another project already uses, or used to use, this web address. Choose a different one.",
        });
      case "unknown-architect":
        return fail("One of the chosen architects no longer exists. Reload the page and choose again.");
      case "not-ready":
        return fail("This project is published, so these problems must be fixed before saving:", {}, result.problems);
    }
  }

  deps.invalidate([...new Set([PROJECTS_TAG, projectTag(result.slug), projectTag(result.previousSlug)])]);

  return editing
    ? { status: "saved", id: result.id, message: `"${parsed.data.title}" was saved.` }
    : { status: "created", id: result.id, message: `"${parsed.data.title}" was created as a draft.` };
}
