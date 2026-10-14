import Link from "next/link";
import { buttonStyles } from "@/components/ui/button-styles";
import { hasActiveFilters } from "@/lib/filters";
import type { ProjectFilters } from "@/lib/types";
import type { ProjectListResult } from "@/server/queries/project-queries";
import { Pagination } from "./pagination";
import { ProjectCard } from "./project-card";

const CARD_SIZES = "(min-width: 1152px) 352px, (min-width: 640px) 33vw, calc(100vw - 2rem)";
/** Cards in the first row on desktop; their images load eagerly because they are above the fold. */
const EAGER_COUNT = 3;

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-xl border border-border p-8">
      <h2 className="font-display text-2xl">
        {filtered ? "No projects match these filters" : "No projects yet"}
      </h2>
      <p className="max-w-prose text-muted">
        {filtered
          ? "Try a different type, location or year, or clear the filters to see every project."
          : "Projects will appear here once they are published."}
      </p>
      {filtered && (
        <Link href="/projects" className={buttonStyles({ variant: "secondary" })}>
          Clear filters
        </Link>
      )}
    </div>
  );
}

export function ProjectResults({ result, filters }: { result: ProjectListResult; filters: ProjectFilters }) {
  const { items, total, page, pageCount } = result;

  return (
    <div className="flex flex-col gap-8">
      <p role="status" className="text-muted">
        {total === 1 ? "1 project" : `${total} projects`}
        {pageCount > 1 && ` · page ${page} of ${pageCount}`}
      </p>
      {items.length > 0 ? (
        <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((project, index) => (
            <li key={project.slug}>
              <ProjectCard project={project} sizes={CARD_SIZES} eager={index < EAGER_COUNT} headingLevel="h2" />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState filtered={hasActiveFilters(filters)} />
      )}
      <Pagination filters={filters} page={page} pageCount={pageCount} />
    </div>
  );
}
