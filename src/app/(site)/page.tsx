import type { Metadata } from "next";
import Link from "next/link";
import { FeaturedProjects } from "@/components/home/featured-projects";
import { Hero } from "@/components/home/hero";
import { buttonStyles } from "@/components/ui/button-styles";
import { pageMetadata } from "@/lib/seo";
import { getFeaturedProjects } from "@/server/queries/projects";

export const metadata: Metadata = pageMetadata({
  description: "Architectural concepts and urban visions exploring new possibilities for the places we live, move, and connect.",
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
      <section aria-labelledby="about-title" className="on-panel my-14 flex flex-col items-start gap-6 rounded-3xl bg-panel p-8 text-panel-foreground sm:p-14">
        <h2 id="about-title" className="font-display text-3xl sm:text-4xl">
          About the author
        </h2>
        <p className="max-w-2xl text-lg text-panel-muted">
          I&rsquo;m Michael Beskin. I work from architectural thinking, digital tools and
          AI-assisted visualization, and I present each concept with its context, my role and the
          limits of the study. These are independent studies, not approved development plans.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/about" className={buttonStyles({ variant: "inverse" })}>
            Read more about me
          </Link>
          <Link href="/contact" className={buttonStyles({ variant: "inverse" })}>
            Get in touch
          </Link>
        </div>
      </section>
    </>
  );
}
