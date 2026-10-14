"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "@/lib/site";

/** Marks the current section with aria-current, including nested routes like /projects/[slug]. */
export function NavLinks({
  className,
  linkClassName,
  onNavigate,
}: {
  className?: string;
  linkClassName?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <ul className={className}>
      {NAV_ITEMS.map(({ href, label }) => {
        const current = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={current ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "inline-flex min-h-11 items-center underline-offset-8 hover:underline aria-[current=page]:underline aria-[current=page]:decoration-2",
                linkClassName,
              )}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
