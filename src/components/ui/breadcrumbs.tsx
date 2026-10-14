import Link from "next/link";

export interface Crumb {
  label: string;
  /** Omit on the last crumb: it is the current page. */
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={item.label} className="flex items-center gap-x-2">
              {item.href && !last ? (
                <Link href={item.href} className="inline-flex min-h-11 items-center underline underline-offset-4">
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-foreground">
                  {item.label}
                </span>
              )}
              {!last && (
                <span aria-hidden="true" className="select-none">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
