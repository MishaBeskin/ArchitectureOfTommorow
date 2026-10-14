import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button-styles";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description: "About Architecture of Tomorrow, a showcase of new architecture projects.",
  path: "/about",
});

// Placeholder copy: replace with the real story before launch.
export default function AboutPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="font-display text-5xl leading-[0.95] sm:text-7xl">About</h1>
      <p className="text-xl font-semibold text-blue sm:text-2xl">
        Architecture of Tomorrow is a curated showcase of new architecture projects: the ideas,
        the places and the people behind them.
      </p>
      <p className="text-lg text-muted">
        Each project page brings together renderings, a description of the design, the architect,
        the location and the year, so you can see how a building came to be.
      </p>
      <div>
        <Link href="/projects" className={buttonStyles()}>
          Browse projects
        </Link>
      </div>
    </div>
  );
}
