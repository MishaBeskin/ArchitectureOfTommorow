import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="font-serif text-xl font-medium sm:text-2xl">
          {SITE_NAME}
        </Link>
        <nav aria-label="Main" className="hidden md:block">
          <NavLinks className="flex items-center gap-8" />
        </nav>
        <MobileNav />
      </div>
    </header>
  );
}
