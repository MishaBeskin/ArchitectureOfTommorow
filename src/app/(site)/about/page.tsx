import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button-styles";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description:
    "Michael Beskin, a designer and developer with a background in architecture and interior design, presents independent architectural concepts and urban design studies.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="font-display text-5xl leading-[0.95] sm:text-7xl">About</h1>
      <p className="text-xl font-semibold text-blue sm:text-2xl">
        Exploring Architecture, Connecting Places
      </p>
      <p className="text-lg text-muted">
        I’m Michael Beskin, a designer and developer with a background in architecture and interior
        design. My work explores how buildings, landscapes, and infrastructure can come together to
        create more connected and welcoming places.
      </p>
      <p className="text-lg text-muted">
        This portfolio presents architectural concepts and urban design studies, from neighborhood
        renewal and healthcare campuses to transport hubs and airport expansion. Each project
        considers both the larger urban context and the everyday experience of the people who use
        it, with an emphasis on accessibility, public space, and opportunities for future growth.
      </p>
      <p className="text-lg text-muted">
        Combining architectural thinking with digital tools and AI-assisted visualization, I
        develop ideas into visual proposals that invite discussion about how our cities could
        evolve.
      </p>
      <p className="text-lg text-muted">
        The projects shown are independent conceptual studies, presented as design explorations
        rather than approved development plans.
      </p>
      <div>
        <Link href="/projects" className={buttonStyles()}>
          Browse projects
        </Link>
      </div>
    </div>
  );
}
