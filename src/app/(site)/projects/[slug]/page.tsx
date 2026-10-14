import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ProjectDescription } from "@/components/projects/project-description";
import { ProjectFacts } from "@/components/projects/project-facts";
import { ProjectGallery } from "@/components/projects/project-gallery";
import { RelatedProjects } from "@/components/projects/related-projects";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { breadcrumbJsonLd, projectJsonLd } from "@/lib/json-ld";
import { pageMetadata } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-url";
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
  const title = project.seoTitle ?? project.title;
  const description = project.seoDescription ?? project.summary;
  const cover = project.coverImage;
  const base = pageMetadata({ title, description, path: `/projects/${project.slug}` });

  return {
    ...base,
    // The cover is the social preview; without one the site-wide default image applies.
    ...(cover
      ? {
          openGraph: {
            ...base.openGraph,
            images: [{ url: cover.url, width: cover.width, height: cover.height, alt: cover.alt }],
          },
          twitter: { ...base.twitter, images: [cover.url] },
        }
      : {}),
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

  const siteUrl = getSiteUrl();

  return (
    <article className="flex flex-col gap-10">
      <JsonLd
        data={[
          breadcrumbJsonLd(siteUrl, [
            { name: "Home", path: "/" },
            { name: "Projects", path: "/projects" },
            { name: project.title, path: `/projects/${project.slug}` },
          ]),
          projectJsonLd(siteUrl, project),
        ]}
      />
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Projects", href: "/projects" },
            { label: project.title },
          ]}
        />
        <header className="max-w-4xl">
          <h1 className="font-display text-5xl leading-[0.95] sm:text-7xl">
            {project.title}
          </h1>
          <p className="mt-5 text-xl font-semibold text-blue sm:text-2xl">{project.summary}</p>
        </header>
      </div>

      <ProjectGallery images={images} title={project.title} />

      <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="about-project" className="flex flex-col gap-4">
          <h2 id="about-project" className="font-display text-3xl">
            About this project
          </h2>
          <ProjectDescription markdown={project.descriptionMd} />
        </section>
        <aside
          aria-labelledby="project-details"
          className="on-panel rounded-3xl bg-panel p-8 text-panel-foreground lg:sticky lg:top-24 lg:self-start"
        >
          <h2 id="project-details" className="mb-6 font-display text-2xl">
            Details
          </h2>
          <ProjectFacts project={project} />
        </aside>
      </div>

      <RelatedProjects projects={related} />
    </article>
  );
}
