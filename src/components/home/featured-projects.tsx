import Link from "next/link";
import { ProjectCard } from "@/components/projects/project-card";
import type { ProjectCardData } from "@/lib/types";

const CARD_SIZES = "(min-width: 1152px) 352px, (min-width: 640px) 33vw, calc(100vw - 2rem)";

export function FeaturedProjects({ projects }: { projects: ProjectCardData[] }) {
  if (projects.length === 0) return null;

  return (
    <section aria-labelledby="featured-title" className="flex flex-col gap-8 py-10">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h2 id="featured-title" className="font-serif text-3xl font-medium sm:text-4xl">
          Featured projects
        </h2>
        <Link href="/projects" className="inline-flex min-h-11 items-center underline underline-offset-4">
          View all projects
        </Link>
      </div>
      <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <li key={project.slug}>
            <ProjectCard project={project} sizes={CARD_SIZES} />
          </li>
        ))}
      </ul>
    </section>
  );
}
