import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/server/auth/require-admin";

export const metadata: Metadata = { title: "Projects" };

export default function AdminProjectsPage() {
  return (
    <Suspense fallback={null}>
      <AdminProjects />
    </Suspense>
  );
}

async function AdminProjects() {
  // Every admin page checks for itself; the layout's check is not enough on its own.
  await requireAdmin();

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="font-serif text-4xl font-medium">Projects</h1>
      <p className="text-lg text-muted">
        You are signed in. Managing projects (create, edit, publish and delete) is built in the next steps.
      </p>
    </div>
  );
}
