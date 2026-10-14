import { cacheLife } from "next/cache";
import Link from "next/link";
import { NAV_ITEMS, SITE_NAME } from "@/lib/site";

export async function SiteFooter() {
  // Cached so the current year is computed once per day, not on every request.
  "use cache";
  cacheLife("days");

  return (
    <footer className="on-panel mt-auto bg-panel text-panel-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="font-display text-2xl">{SITE_NAME}</p>
          <p className="mt-2 text-sm text-panel-muted">
            © {new Date().getFullYear()} {SITE_NAME}
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6">
            {NAV_ITEMS.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
