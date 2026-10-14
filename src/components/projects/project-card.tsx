import Image from "next/image";
import Link from "next/link";
import { formatLocation, formatProjectType } from "@/lib/format";
import type { ProjectCardData } from "@/lib/types";

/**
 * The title link covers the whole card (via ::after), so there is one tab stop per project and
 * a large click target without nesting interactive elements.
 */
export function ProjectCard({
  project,
  sizes,
  eager = false,
  headingLevel = "h3",
}: {
  project: ProjectCardData;
  sizes: string;
  /** Load immediately instead of lazily; use for images in the first row above the fold. */
  eager?: boolean;
  /** Heading levels must not skip: h2 when the cards sit directly under the page's h1, else h3. */
  headingLevel?: "h2" | "h3";
}) {
  const { cover } = project;
  const Heading = headingLevel;

  return (
    <article className="group relative flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl bg-surface">
        {cover ? (
          <Image
            src={cover.url}
            alt={cover.alt}
            width={cover.width}
            height={cover.height}
            sizes={sizes}
            loading={eager ? "eager" : "lazy"}
            placeholder="blur"
            blurDataURL={cover.blurDataUrl}
            className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="aspect-[4/3] w-full" role="img" aria-label="No image available" />
        )}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-blue">
          {formatProjectType(project.type)} · {project.year}
        </p>
        <Heading className="font-display text-2xl leading-[1.05]">
          <Link
            href={`/projects/${project.slug}`}
            className="after:absolute after:inset-0 after:content-[''] group-hover:underline"
          >
            {project.title}
          </Link>
        </Heading>
        <p className="text-muted">{formatLocation(project.location)}</p>
        {project.architectNames.length > 0 && (
          <p className="text-sm text-muted">{project.architectNames.join(", ")}</p>
        )}
      </div>
    </article>
  );
}
