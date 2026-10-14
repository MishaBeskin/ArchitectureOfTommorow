import Link from "next/link";
import type { ProjectStatus } from "@/lib/types";

/** Where the project stands: public, or a draft with the list of what is still missing. */
export function PublishStatus({
  status,
  slug,
  problems,
}: {
  status: ProjectStatus;
  slug: string;
  problems: string[];
}) {
  if (status === "published") {
    return (
      <p className="rounded-lg border border-border p-4">
        <strong>Published.</strong> Visitors can see this project.{" "}
        <Link href={`/projects/${slug}`} className="underline underline-offset-4">
          View it on the site
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <p>
        <strong>Draft.</strong> Only you can see this project.
      </p>
      {problems.length === 0 ? (
        <p className="mt-2">It is ready to publish. Use Publish in the projects list.</p>
      ) : (
        <>
          <p className="mt-2">Before it can be published:</p>
          <ul className="list-disc pl-6">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
