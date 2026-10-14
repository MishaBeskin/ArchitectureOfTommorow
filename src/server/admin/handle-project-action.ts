import { z } from "zod";
import { PROJECTS_TAG, projectTag } from "@/lib/cache-tags";
import type { AnyDb } from "../db/types";
import { deleteProject, setProjectFeatured, setProjectStatus } from "../mutations/projects";

export type ProjectActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; problems?: string[] };

const inputSchema = z.object({
  id: z.uuid(),
  intent: z.enum(["publish", "unpublish", "feature", "unfeature", "delete"]),
});

export interface ProjectActionDeps {
  db: AnyDb;
  /** Removes stored image files. Failing must not undo a delete that already happened. */
  removeFiles: (pathnames: string[]) => Promise<void>;
  /** Expires cached public pages so the change shows up on the next visit. */
  invalidate: (tags: string[]) => void;
  log: { warn: (message: string, meta?: unknown) => void };
}

const error = (message: string, problems?: string[]): ProjectActionState => ({ status: "error", message, problems });

/**
 * One handler for every button in the projects table. The caller has already checked that the
 * user is the admin; this validates the input, makes the change, and expires the right cache tags.
 */
export async function handleProjectAction(
  deps: ProjectActionDeps,
  raw: { id: unknown; intent: unknown },
): Promise<ProjectActionState> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return error("That request was not valid. Please reload the page and try again.");
  const { id, intent } = parsed.data;

  const gone = error("That project no longer exists. Reload the page to see the current list.");
  const expire = (slug: string) => deps.invalidate([PROJECTS_TAG, projectTag(slug)]);

  if (intent === "publish" || intent === "unpublish") {
    const result = await setProjectStatus(deps.db, id, intent === "publish" ? "published" : "draft");
    if (!result.ok) {
      if (result.reason === "not-found") return gone;
      return error(`"${result.title}" cannot be published yet.`, result.problems);
    }
    expire(result.slug);
    return {
      status: "success",
      message:
        intent === "publish"
          ? `"${result.title}" is now published.`
          : `"${result.title}" is now a draft and no longer public.`,
    };
  }

  if (intent === "feature" || intent === "unfeature") {
    const result = await setProjectFeatured(deps.db, id, intent === "feature");
    if (!result.ok) return gone;
    expire(result.slug);
    const note = result.featured && result.status !== "published" ? " It will appear once it is published." : "";
    return {
      status: "success",
      message: result.featured
        ? `"${result.title}" is featured on the home page.${note}`
        : `"${result.title}" is no longer featured.`,
    };
  }

  const result = await deleteProject(deps.db, id);
  if (!result.ok) return gone;
  expire(result.slug);
  try {
    await deps.removeFiles(result.pathnames);
  } catch (cause) {
    // The project is already gone; stray files are harmless and can be swept up later.
    deps.log.warn("Project deleted but some stored files could not be removed", cause);
  }
  return { status: "success", message: `"${result.title}" was deleted.` };
}
