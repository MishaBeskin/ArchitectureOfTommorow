import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProjectsTable } from "@/components/admin/projects-table";
import { buttonStyles } from "@/components/ui/button-styles";
import { requireAdmin } from "@/server/auth/require-admin";
import { getDb } from "@/server/db/client";
import { listAdminProjects } from "@/server/queries/admin-projects";
import { projectAction } from "./actions";

export const metadata: Metadata = { title: "Projects" };

export default function AdminProjectsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-4xl font-medium">Projects</h1>
        <Link href="/admin/projects/new" className={buttonStyles()}>
          New project
        </Link>
      </div>
      <Suspense fallback={<p role="status" className="text-muted">Loading projects…</p>}>
        <AdminProjects />
      </Suspense>
    </div>
  );
}

async function AdminProjects() {
  // Every admin page checks for itself; the layout's check is not enough on its own.
  await requireAdmin();
  // Live, uncached read: the admin must see drafts and its own changes immediately.
  const rows = await listAdminProjects(getDb());

  return <ProjectsTable rows={rows} action={projectAction} />;
}
