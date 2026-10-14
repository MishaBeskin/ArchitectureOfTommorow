import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArchitectsTable } from "@/components/admin/architects-table";
import { buttonStyles } from "@/components/ui/button-styles";
import { requireAdmin } from "@/server/auth/require-admin";
import { getDb } from "@/server/db/client";
import { listAdminArchitects } from "@/server/queries/admin-architects";
import { deleteArchitectAction } from "./actions";

export const metadata: Metadata = { title: "Architects" };

export default function AdminArchitectsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-4xl font-medium">Architects</h1>
        <Link href="/admin/architects/new" className={buttonStyles()}>
          Add architect
        </Link>
      </div>
      <Suspense fallback={<p role="status" className="text-muted">Loading architects…</p>}>
        <AdminArchitects />
      </Suspense>
    </div>
  );
}

async function AdminArchitects() {
  // Every admin page checks for itself; the layout's check is not enough on its own.
  await requireAdmin();
  const rows = await listAdminArchitects(getDb());

  return <ArchitectsTable rows={rows} action={deleteArchitectAction} />;
}
