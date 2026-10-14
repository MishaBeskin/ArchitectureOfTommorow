import { cacheLife } from "next/cache";
import Link from "next/link";
import { NAV_ITEMS, SITE_NAME } from "@/lib/site";

export async function SiteFooter() {
  // Cached so the current year is computed once per day, not on every request.
  "use cache";
  cacheLife("days");

  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm text-muted">
          © {new Date().getFullYear()} {SITE_NAME}
        </p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6">
            {NAV_ITEMS.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="inline-flex min-h-11 items-center hover:underline">
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
