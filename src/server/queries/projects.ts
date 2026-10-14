import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { ProjectFilters } from "@/lib/types";
import { getDb } from "../db/client";
import * as queries from "./project-queries";

/*
 * Cached, tagged entry points used by pages. Admin mutations call updateTag("projects") and
 * updateTag(`project:${slug}`) so edits show up immediately; "days" is only a safety net.
 * Logic lives in ./project-queries.ts so it can be tested without Next.js.
 */

export const PROJECTS_TAG = "projects";
export const projectTag = (slug: string) => `project:${slug}`;

export async function getFeaturedProjects(limit = 6) {
  "use cache";
  cacheTag(PROJECTS_TAG);
  cacheLife("days");
  return queries.getFeaturedProjects(getDb(), limit);
}

export async function listProjects(filters: ProjectFilters) {
  "use cache";
  cacheTag(PROJECTS_TAG);
  cacheLife("days");
  return queries.listProjects(getDb(), filters);
}

export async function getProjectPage(slug: string) {
  "use cache";
  cacheTag(PROJECTS_TAG, projectTag(slug));
  cacheLife("days");
  return queries.getProjectPage(getDb(), slug);
}

export async function getRelatedProjects(slug: string) {
  "use cache";
  cacheTag(PROJECTS_TAG, projectTag(slug));
  cacheLife("days");
  return queries.getRelatedProjects(getDb(), slug);
}

export async function getFilterOptions() {
  "use cache";
  cacheTag(PROJECTS_TAG);
  cacheLife("days");
  return queries.getFilterOptions(getDb());
}

export async function getPublishedSlugs() {
  "use cache";
  cacheTag(PROJECTS_TAG);
  cacheLife("days");
  return queries.getPublishedSlugs(getDb());
}
