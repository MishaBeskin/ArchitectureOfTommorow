import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { formatLocation, formatPhase, formatProjectType } from "@/lib/format";
import type { Project } from "@/lib/types";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-white/15 py-4 first:border-t-0 first:pt-0">
      <dt className="text-sm font-semibold text-panel-muted">{label}</dt>
      <dd className="text-lg text-panel-foreground">{children}</dd>
    </div>
  );
}

export function ProjectFacts({ project }: { project: Project }) {
  const { architects } = project;

  return (
    <dl>
      {architects.length > 0 && (
        <Fact label={architects.length > 1 ? "Architects" : "Architect"}>
          <ul className="flex flex-col gap-1">
            {architects.map((architect) => (
              <li key={architect.id}>
                {architect.websiteUrl ? (
                  <a
                    href={architect.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4"
                  >
                    {architect.name}
                    <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
                  </a>
                ) : (
                  architect.name
                )}
                {architect.role && <span className="text-panel-muted"> · {architect.role}</span>}
              </li>
            ))}
          </ul>
        </Fact>
      )}
      <Fact label="Location">{formatLocation(project.location)}</Fact>
      <Fact label="Year">{project.year}</Fact>
      <Fact label="Type">{formatProjectType(project.type)}</Fact>
      <Fact label="Status">{formatPhase(project.phase)}</Fact>
    </dl>
  );
}
