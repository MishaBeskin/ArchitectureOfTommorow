import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { ImageManager } from "@/components/admin/image-manager";
import { ProjectForm } from "@/components/admin/project-form";
import { PublishStatus } from "@/components/admin/publish-status";
import { countryOptions } from "@/lib/countries";
import { projectToFormInitial } from "@/lib/project-form";
import { publishProblems } from "@/lib/publish-readiness";
import { requireAdmin } from "@/server/auth/require-admin";
import { getDb } from "@/server/db/client";
import { getProjectForEdit, listArchitectOptions } from "@/server/queries/admin-projects";
import { attachImageAction, imageAction } from "../image-actions";
import { saveProjectAction } from "../save-action";

export const metadata: Metadata = { title: "Edit project" };

export default function EditProjectPage(props: PageProps<"/admin/projects/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/projects" className="w-fit underline underline-offset-4">
        Back to projects
      </Link>
      <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}>
        <EditProject {...props} />
      </Suspense>
    </div>
  );
}

async function EditProject({ params, searchParams }: PageProps<"/admin/projects/[id]">) {
  // Every admin page checks for itself; the layout's check is not enough on its own.
  await requireAdmin();

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const db = getDb();
  const found = await getProjectForEdit(db, id);
  if (!found) notFound();
  const { project, credits, images } = found;
  const architects = await listArchitectOptions(db);
  const { created } = await searchParams;

  return (
    <>
      <h1 className="font-display text-4xl">{project.title}</h1>
      {created === "1" && (
        <p role="status" className="rounded-lg border-2 border-accent p-4 font-medium">
          The draft was created. You can keep adding details below.
        </p>
      )}
      <PublishStatus
        status={project.status}
        slug={project.slug}
        problems={publishProblems({ summary: project.summary, coverImageId: project.coverImageId, images })}
      />
      <ProjectForm
        action={saveProjectAction}
        initial={projectToFormInitial(project, credits)}
        architects={architects}
        countries={countryOptions()}
        projectId={project.id}
      />
      <ImageManager
        projectId={project.id}
        images={images}
        coverImageId={project.coverImageId}
        action={imageAction}
        attach={attachImageAction}
      />
    </>
  );
}
