import Link from "next/link";
import { cn } from "@/lib/cn";
import { projectsHref } from "@/lib/filters";
import { getPageWindow } from "@/lib/pagination";
import type { ProjectFilters } from "@/lib/types";

const item =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 hover:bg-surface aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground aria-[current=page]:hover:bg-accent";

/** Plain links that keep the active filters, so every page is a shareable, crawlable URL. */
export function Pagination({
  filters,
  page,
  pageCount,
}: {
  filters: ProjectFilters;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const href = (target: number) => projectsHref({ ...filters, page: target });

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center gap-2">
      {page > 1 && (
        <Link href={href(page - 1)} rel="prev" className={cn(item, "border border-border-strong")}>
          Previous
        </Link>
      )}
      <ul className="flex flex-wrap items-center gap-1">
        {getPageWindow(page, pageCount).map((entry, index) =>
          entry === "ellipsis" ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-muted">
              …
            </li>
          ) : (
            <li key={entry}>
              <Link
                href={href(entry)}
                aria-label={`Page ${entry}`}
                aria-current={entry === page ? "page" : undefined}
                className={item}
              >
                {entry}
              </Link>
            </li>
          ),
        )}
      </ul>
      {page < pageCount && (
        <Link href={href(page + 1)} rel="next" className={cn(item, "border border-border-strong")}>
          Next
        </Link>
      )}
    </nav>
  );
}
