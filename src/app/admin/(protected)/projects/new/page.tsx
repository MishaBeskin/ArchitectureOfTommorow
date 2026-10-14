import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProjectForm } from "@/components/admin/project-form";
import { countryOptions } from "@/lib/countries";
import { emptyProjectForm } from "@/lib/project-form";
import { requireAdmin } from "@/server/auth/require-admin";
import { getDb } from "@/server/db/client";
import { listArchitectOptions } from "@/server/queries/admin-projects";
import { saveProjectAction } from "../save-action";

export const metadata: Metadata = { title: "New project" };

export default function NewProjectPage() {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/projects" className="w-fit underline underline-offset-4">
        Back to projects
      </Link>
      <h1 className="font-display text-4xl">New project</h1>
      <p className="text-muted">It is saved as a draft. Nothing is public until you publish it.</p>
      <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}>
        <NewProject />
      </Suspense>
    </div>
  );
}

async function NewProject() {
  // Every admin page checks for itself; the layout's check is not enough on its own.
  await requireAdmin();
  const architects = await listArchitectOptions(getDb());

  return (
    <ProjectForm
      action={saveProjectAction}
      initial={emptyProjectForm(new Date().getFullYear())}
      architects={architects}
      countries={countryOptions()}
    />
  );
}
