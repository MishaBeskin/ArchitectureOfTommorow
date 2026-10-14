import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArchitectForm } from "@/components/admin/architect-form";
import { requireAdmin } from "@/server/auth/require-admin";
import { saveArchitectAction } from "../actions";

export const metadata: Metadata = { title: "Add architect" };

export default function NewArchitectPage() {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/architects" className="w-fit underline underline-offset-4">
        Back to architects
      </Link>
      <h1 className="font-serif text-4xl font-medium">Add architect</h1>
      <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}>
        <NewArchitect />
      </Suspense>
    </div>
  );
}

async function NewArchitect() {
  // Every admin page checks for itself; the layout's check is not enough on its own.
  await requireAdmin();

  return <ArchitectForm action={saveArchitectAction} initial={{ name: "", slug: "", websiteUrl: "", bio: "" }} />;
}
