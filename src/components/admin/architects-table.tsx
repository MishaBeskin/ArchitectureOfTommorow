"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/cn";
import type { DeleteArchitectState } from "@/server/admin/handle-architect";
import type { AdminArchitectRow } from "@/server/queries/admin-architects";

export type ArchitectsTableAction = (
  previous: DeleteArchitectState,
  formData: FormData,
) => Promise<DeleteArchitectState>;

const IDLE: DeleteArchitectState = { status: "idle" };

export function ArchitectsTable({ rows, action }: { rows: AdminArchitectRow[]; action: ArchitectsTableAction }) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const [deleting, setDeleting] = useState<AdminArchitectRow | null>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  // Move focus to the outcome: after a delete the row that had focus no longer exists.
  useEffect(() => {
    if (state.status !== "idle") messageRef.current?.focus();
  }, [state]);

  const projectWord = (count: number) => (count === 1 ? "1 project" : `${count} projects`);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted">{rows.length === 1 ? "1 architect" : `${rows.length} architects`}</p>

      {state.status !== "idle" && (
        <div
          ref={messageRef}
          tabIndex={-1}
          role={state.status === "error" ? "alert" : "status"}
          className={cn(
            "rounded-lg border-2 p-4 font-medium",
            state.status === "error" ? "border-danger text-danger" : "border-border-strong",
          )}
        >
          {state.message}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-border p-8 text-lg text-muted">No architects yet.</p>
      ) : (
        <div role="region" aria-label="Architects" tabIndex={0} className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[36rem] border-collapse text-left">
            <caption className="sr-only">All architects, by name</caption>
            <thead className="bg-surface text-sm">
              <tr>
                {["Name", "Website", "Projects", "Actions"].map((name) => (
                  <th key={name} scope="col" className="px-4 py-3 font-medium">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border align-top">
                  <th scope="row" className="px-4 py-4 font-serif text-lg font-medium">
                    {row.name}
                  </th>
                  <td className="px-4 py-4 text-sm">
                    {row.websiteUrl ? (
                      <a href={row.websiteUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                        {row.websiteUrl.replace(/^https?:\/\//, "")}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      <span className="text-muted">None</span>
                    )}
                  </td>
                  <td className="px-4 py-4">{projectWord(row.projectCount)}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/architects/${row.id}`}
                        aria-label={`Edit ${row.name}`}
                        className="inline-flex min-h-11 items-center px-2 underline underline-offset-4"
                      >
                        Edit
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label={`Delete ${row.name}`}
                        disabled={pending}
                        onClick={() => setDeleting(row)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this architect?"
        description={
          deleting
            ? deleting.projectCount > 0
              ? `"${deleting.name}" is credited on ${projectWord(deleting.projectCount)}, so it cannot be deleted until those credits are removed.`
              : `"${deleting.name}" will be permanently removed. This cannot be undone.`
            : ""
        }
      >
        {deleting && (
          <form action={formAction} onSubmit={() => setDeleting(null)} className="contents">
            <input type="hidden" name="id" value={deleting.id} />
            <Button type="button" variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger">
              Delete architect
            </Button>
          </form>
        )}
      </ConfirmDialog>
    </div>
  );
}
