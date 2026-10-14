import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ProjectDescription } from "@/components/projects/project-description";
import { ProjectFacts } from "@/components/projects/project-facts";
import { ProjectGallery } from "@/components/projects/project-gallery";
import { RelatedProjects } from "@/components/projects/related-projects";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  getProjectPage,
  getPublishedSlugs,
  getRelatedProjects,
} from "@/server/queries/projects";

/**
 * "navigation": the complete page must be static output, and a slug that was not prerendered
 * makes the first request wait for that output instead of getting a generic shell. That is what
 * lets an unknown slug be a real 404 and a renamed one a real 308: without it the shell is sent
 * first (status 200) and notFound()/permanentRedirect() can only act after streaming started.
 * It also forbids request-time data here, so everything this page reads must stay cached.
 */
export const ensureStatic = "navigation";

/**
 * Published projects are prerendered at build time; ones published later render on first visit
 * and are cached. Cache Components requires at least one param, so a placeholder stands in when
 * nothing is published yet: it resolves to "not found" like any unknown slug.
 */
export async function generateStaticParams() {
  const slugs = await getPublishedSlugs();
  return (slugs.length > 0 ? slugs : ["__placeholder__"]).map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const result = await getProjectPage(slug);
  if (result.kind !== "found") return {};
  const { project } = result;
  return {
    title: project.seoTitle ?? project.title,
    description: project.seoDescription ?? project.summary,
  };
}

export default async function ProjectPage(props: PageProps<"/projects/[slug]">) {
  // Awaited before anything streams, so an unknown slug is a real 404 and a renamed one a real 308.
  const { slug } = await props.params;
  const result = await getProjectPage(slug);

  if (result.kind === "redirect") permanentRedirect(`/projects/${result.slug}`);
  if (result.kind === "not-found") notFound();

  const { project } = result;
  const related = await getRelatedProjects(project.slug);
  // The cover leads the gallery; the rest follow in their saved order.
  const images = project.coverImage
    ? [project.coverImage, ...project.images.filter((image) => image.id !== project.coverImage?.id)]
    : project.images;

  return (
    <article className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Projects", href: "/projects" },
            { label: project.title },
          ]}
        />
        <header className="max-w-3xl">
          <h1 className="font-serif text-4xl font-medium leading-tight tracking-tight sm:text-6xl">
            {project.title}
          </h1>
          <p className="mt-4 text-xl text-muted">{project.summary}</p>
        </header>
      </div>

      <ProjectGallery images={images} title={project.title} />

      <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="about-project" className="flex flex-col gap-4">
          <h2 id="about-project" className="font-serif text-3xl font-medium">
            About this project
          </h2>
          <ProjectDescription markdown={project.descriptionMd} />
        </section>
        <aside aria-labelledby="project-details" className="lg:sticky lg:top-6 lg:self-start">
          <h2 id="project-details" className="mb-4 font-serif text-3xl font-medium">
            Details
          </h2>
          <ProjectFacts project={project} />
        </aside>
      </div>

      <RelatedProjects projects={related} />
    </article>
  );
}
