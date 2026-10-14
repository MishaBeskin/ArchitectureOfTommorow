import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <Link href="/" className="font-display text-xl tracking-wide sm:text-2xl">
          {SITE_NAME}
        </Link>
        <nav aria-label="Main" className="hidden md:block">
          <NavLinks className="flex items-center gap-8" linkClassName="text-[0.95rem] font-medium" />
        </nav>
        <MobileNav />
      </div>
    </header>
  );
}
