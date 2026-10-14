import Image from "next/image";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button-styles";
import { formatLocation } from "@/lib/format";
import type { ProjectCardData } from "@/lib/types";

/** `lead` is the first featured project; its cover is the page's LCP image. */
export function Hero({ lead }: { lead: ProjectCardData | null }) {
  const cover = lead?.cover;

  return (
    <section aria-labelledby="hero-title" className="flex flex-col gap-10 py-4 sm:py-8">
      <div className="max-w-3xl">
        <h1
          id="hero-title"
          className="font-serif text-5xl font-medium leading-[1.05] tracking-tight sm:text-7xl"
        >
          Architecture of Tomorrow
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted sm:text-xl">
          New architecture projects, shown through renderings, the people who designed them and the
          places they belong to.
        </p>
        <div className="mt-8">
          <Link href="/projects" className={buttonStyles({ size: "lg" })}>
            Browse projects
          </Link>
        </div>
      </div>

      {lead && cover && (
        <figure className="flex flex-col gap-3">
          {/* Decorative duplicate of the caption link, so it is hidden from keyboards and screen readers. */}
          <Link
            href={`/projects/${lead.slug}`}
            tabIndex={-1}
            aria-hidden="true"
            className="block overflow-hidden rounded-2xl bg-surface"
          >
            <Image
              src={cover.url}
              alt={cover.alt}
              width={cover.width}
              height={cover.height}
              sizes="(min-width: 1152px) 1104px, calc(100vw - 2rem)"
              placeholder="blur"
              blurDataURL={cover.blurDataUrl}
              preload
              className="aspect-[16/9] w-full object-cover"
            />
          </Link>
          <figcaption className="text-muted">
            <Link href={`/projects/${lead.slug}`} className="font-medium text-foreground underline underline-offset-4">
              {lead.title}
            </Link>
            {" · "}
            {formatLocation(lead.location)} · {lead.year}
          </figcaption>
        </figure>
      )}
    </section>
  );
}
