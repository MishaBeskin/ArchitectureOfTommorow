import type { Metadata } from "next";
import Link from "next/link";
import { FeaturedProjects } from "@/components/home/featured-projects";
import { Hero } from "@/components/home/hero";
import { buttonStyles } from "@/components/ui/button-styles";
import { pageMetadata } from "@/lib/seo";
import { getFeaturedProjects } from "@/server/queries/projects";

export const metadata: Metadata = pageMetadata({
  description: "New architecture projects, shown through renderings, the people who designed them and the places they belong to.",
  path: "/",
});

export default async function HomePage() {
  const featured = await getFeaturedProjects();
  const [lead, ...rest] = featured;

  return (
    <>
      <Hero lead={lead ?? null} />
      {/* The lead already appears in the hero, so the grid shows the others. */}
      <FeaturedProjects projects={rest} />
      <section aria-labelledby="about-title" className="flex flex-col items-start gap-6 border-t border-border py-12">
        <h2 id="about-title" className="font-serif text-3xl font-medium sm:text-4xl">
          Every project, documented
        </h2>
        <p className="max-w-2xl text-lg text-muted">
          Each project page brings together renderings, a description of the design, the architect,
          the location and the year.
        </p>
        <Link href="/projects" className={buttonStyles({ variant: "secondary" })}>
          Explore the full list
        </Link>
      </section>
    </>
  );
}
