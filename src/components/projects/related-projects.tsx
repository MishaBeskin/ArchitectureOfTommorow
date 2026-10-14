import type { ProjectCardData } from "@/lib/types";
import { ProjectCard } from "./project-card";

const CARD_SIZES = "(min-width: 1152px) 352px, (min-width: 640px) 33vw, calc(100vw - 2rem)";

export function RelatedProjects({ projects }: { projects: ProjectCardData[] }) {
  if (projects.length === 0) return null;

  return (
    <section aria-labelledby="related-title" className="flex flex-col gap-8 border-t border-border py-12">
      <h2 id="related-title" className="font-display text-3xl sm:text-4xl">
        More projects
      </h2>
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
