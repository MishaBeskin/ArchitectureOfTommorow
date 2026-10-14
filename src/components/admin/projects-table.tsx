"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/cn";
import { countryName, formatProjectType } from "@/lib/format";
import type { ProjectActionState } from "@/server/admin/handle-project-action";
import type { AdminProjectRow } from "@/server/queries/admin-projects";

export type ProjectsTableAction = (previous: ProjectActionState, formData: FormData) => Promise<ProjectActionState>;

const IDLE: ProjectActionState = { status: "idle" };

// Fixed to UTC so the server and the browser print the same text (no hydration mismatch).
const formatDate = (date: Date) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date);

function StatusBadge({ published }: { published: boolean }) {
  // Text and an outline carry the meaning; colour alone would fail for colour-blind users.
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium",
        published ? "border-accent text-accent" : "border-border-strong text-muted",
      )}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}

export function ProjectsTable({ rows, action }: { rows: AdminProjectRow[]; action: ProjectsTableAction }) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const [deleting, setDeleting] = useState<AdminProjectRow | null>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  // Move focus to the outcome so keyboard and screen reader users hear what happened. After a
  // delete the row they pressed no longer exists, so focus would otherwise be lost.
  useEffect(() => {
    if (state.status !== "idle") messageRef.current?.focus();
  }, [state]);

  const published = rows.filter((row) => row.status === "published").length;
  const imageWord = (count: number) => (count === 1 ? "1 image" : `${count} images`);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted">
        {rows.length === 1 ? "1 project" : `${rows.length} projects`} · {published} published ·{" "}
        {rows.length - published} {rows.length - published === 1 ? "draft" : "drafts"}
      </p>

      {state.status !== "idle" && (
        <div
          ref={messageRef}
          tabIndex={-1}
          role={state.status === "error" ? "alert" : "status"}
          className={cn(
            "rounded-lg border-2 p-4",
            state.status === "error" ? "border-danger text-danger" : "border-border-strong",
          )}
        >
          <p className="font-medium">{state.message}</p>
          {state.status === "error" && state.problems && (
            <ul className="mt-2 list-disc pl-5">
              {state.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-border p-8 text-lg text-muted">No projects yet.</p>
      ) : (
        // Scrolls sideways inside its own box on narrow screens, and can be reached by keyboard.
        <div role="region" aria-label="Projects" tabIndex={0} className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[56rem] border-collapse text-left">
            <caption className="sr-only">All projects, newest changes first</caption>
            <thead className="bg-surface text-sm">
              <tr>
                {["Project", "Status", "Type and year", "Location", "Images", "Featured", "Updated", "Actions"].map((name) => (
                  <th key={name} scope="col" className="px-4 py-3 font-medium">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isPublished = row.status === "published";
                return (
                  <tr key={row.id} className="border-t border-border align-top">
                    <th scope="row" className="px-4 py-4 font-medium">
                      <span className="font-serif text-lg">{row.title}</span>
                      <span className="block text-sm font-normal text-muted">{row.slug}</span>
                    </th>
                    <td className="px-4 py-4">
                      <StatusBadge published={isPublished} />
                    </td>
                    <td className="px-4 py-4">
                      {formatProjectType(row.type)} · {row.year}
                    </td>
                    <td className="px-4 py-4">
                      {row.city}, {countryName(row.countryCode)}
                    </td>
                    <td className="px-4 py-4">{imageWord(row.imageCount)}</td>
                    <td className="px-4 py-4">
                      <form action={formAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <Button
                          type="submit"
                          name="intent"
                          value={row.featured ? "unfeature" : "feature"}
                          variant={row.featured ? "primary" : "secondary"}
                          aria-pressed={row.featured}
                          aria-label={`Featured: ${row.title}`}
                          disabled={pending}
                        >
                          {row.featured ? "Featured ✓" : "Featured"}
                        </Button>
                      </form>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted">{formatDate(row.updatedAt)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <form action={formAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <Button
                            type="submit"
                            name="intent"
                            value={isPublished ? "unpublish" : "publish"}
                            variant="secondary"
                            aria-label={`${isPublished ? "Unpublish" : "Publish"} ${row.title}`}
                            disabled={pending}
                          >
                            {isPublished ? "Unpublish" : "Publish"}
                          </Button>
                        </form>
                        {isPublished && (
                          <Link
                            href={`/projects/${row.slug}`}
                            aria-label={`View ${row.title} on the site`}
                            className="inline-flex min-h-11 items-center px-2 underline underline-offset-4"
                          >
                            View
                          </Link>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          aria-label={`Delete ${row.title}`}
                          disabled={pending}
                          onClick={() => setDeleting(row)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this project?"
        description={
          deleting
            ? `"${deleting.title}" and its ${imageWord(deleting.imageCount)} will be permanently removed. This cannot be undone.`
            : ""
        }
      >
        {deleting && (
          <form action={formAction} onSubmit={() => setDeleting(null)} className="contents">
            <input type="hidden" name="id" value={deleting.id} />
            <Button type="button" variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button type="submit" name="intent" value="delete" variant="danger">
              Delete project
            </Button>
          </form>
        )}
      </ConfirmDialog>
    </div>
  );
}
