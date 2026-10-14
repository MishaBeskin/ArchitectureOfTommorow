import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProjectFilters } from "@/components/projects/project-filters";
import { ProjectResults } from "@/components/projects/project-results";
import { ProjectsSkeleton } from "@/components/projects/projects-skeleton";
import {
  canonicalProjectsHref,
  hasActiveFilters,
  needsCanonicalRedirect,
  parseProjectFilters,
  projectsHref,
} from "@/lib/filters";
import { pageMetadata } from "@/lib/seo";
import { getFilterOptions, listProjects } from "@/server/queries/projects";

// Filtered and paginated views share this canonical URL (and are marked noindex in the page body).
export const metadata: Metadata = pageMetadata({
  title: "Projects",
  description: "Browse new architecture projects by type, location and year.",
  path: "/projects",
});

export default function ProjectsPage(props: PageProps<"/projects">) {
  return (
    <div className="flex flex-col gap-8">
      <header className="max-w-2xl">
        <h1 className="font-serif text-4xl font-medium sm:text-5xl">Projects</h1>
        <p className="mt-4 text-lg text-muted">
          Browse new architecture projects. Filter by type, location and year.
        </p>
      </header>
      {/*
        Request-time data (searchParams) streams in behind Suspense, and React reveals it with a
        script. Without JavaScript only the fallback shows, so say so instead of leaving a skeleton
        pulsing forever. The HTML still contains every project for crawlers and link previews.
      */}
      <noscript>
        <style>{`[data-projects-skeleton]{display:none}`}</style>
        <p className="rounded-lg border border-border-strong p-4">
          Browsing and filtering projects needs JavaScript. Please enable it, or get in touch and we
          will send you the list.
        </p>
      </noscript>
      <Suspense fallback={<ProjectsSkeleton />}>
        <ProjectsContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function ProjectsContent({ searchParams }: Pick<PageProps<"/projects">, "searchParams">) {
  const raw = await searchParams;
  const filters = parseProjectFilters(raw);

  // One canonical URL per result set: `?type=` from a plain form, `?page=1`, wrong case, repeats.
  if (needsCanonicalRedirect(raw, filters)) redirect(canonicalProjectsHref(raw, filters));

  // Both are cached and tagged "projects", so an admin edit refreshes them immediately.
  const [options, result] = await Promise.all([getFilterOptions(), listProjects(filters)]);

  // A page past the end (e.g. after projects were unpublished) goes to the last real page.
  if (filters.page !== result.page) redirect(projectsHref({ ...filters, page: result.page }));

  return (
    <>
      {/* Filtered views are duplicates of the main list; keep them out of search results. */}
      {hasActiveFilters(filters) && <meta name="robots" content="noindex, follow" />}
      <ProjectFilters options={options} filters={filters} />
      <ProjectResults result={result} filters={filters} />
    </>
  );
}
