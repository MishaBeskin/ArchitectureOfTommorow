import Link from "next/link";
import type { ReactNode } from "react";
import { SkipLink } from "@/components/site/skip-link";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/architects", label: "Architects" },
  { href: "/admin/messages", label: "Messages" },
] as const;

/** The signed-in frame around every admin page. `logout` is a server action. */
export function AdminShell({
  email,
  logout,
  children,
}: {
  email: string;
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <>
      <SkipLink />
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-1">
            <Link href="/admin/projects" className="font-serif text-xl font-medium">
              Admin
            </Link>
            <nav aria-label="Admin">
              <ul className="flex items-center gap-6">
                {NAV.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="inline-flex min-h-11 items-center underline-offset-8 hover:underline">
                      {label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/" className="inline-flex min-h-11 items-center underline-offset-8 hover:underline">
                    View site
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
          <form action={logout} className="flex items-center gap-4">
            <span className="text-sm text-muted">{email}</span>
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        {children}
      </main>
    </>
  );
}
