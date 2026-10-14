/**
 * Names of the cache tags on public project data. They live here, away from the server-only query
 * wrappers, so admin code (and tests) can name the same tags without importing those.
 */
export const PROJECTS_TAG = "projects";
export const projectTag = (slug: string) => `project:${slug}`;
