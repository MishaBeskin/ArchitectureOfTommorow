import Link from "next/link";
import { buttonStyles } from "@/components/ui/button-styles";

export default function ProjectNotFound() {
  return (
    <div className="flex max-w-xl flex-col items-start gap-6 py-12">
      <h1 className="font-display text-4xl sm:text-5xl">Project not found</h1>
      <p className="text-lg text-muted">
        This project does not exist, or it has not been published yet.
      </p>
      <Link href="/projects" className={buttonStyles()}>
        Browse all projects
      </Link>
    </div>
  );
}
