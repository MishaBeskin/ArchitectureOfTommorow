import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { ArchitectForm } from "@/components/admin/architect-form";
import { requireAdmin } from "@/server/auth/require-admin";
import { getDb } from "@/server/db/client";
import { getArchitectById } from "@/server/queries/admin-architects";
import { saveArchitectAction } from "../actions";

export const metadata: Metadata = { title: "Edit architect" };

export default function EditArchitectPage(props: PageProps<"/admin/architects/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/architects" className="w-fit underline underline-offset-4">
        Back to architects
      </Link>
      <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}>
        <EditArchitect {...props} />
      </Suspense>
    </div>
  );
}

async function EditArchitect({ params, searchParams }: PageProps<"/admin/architects/[id]">) {
  // Every admin page checks for itself; the layout's check is not enough on its own.
  await requireAdmin();

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const architect = await getArchitectById(getDb(), id);
  if (!architect) notFound();
  const { created } = await searchParams;

  return (
    <>
      <h1 className="font-serif text-4xl font-medium">{architect.name}</h1>
      {created === "1" && (
        <p role="status" className="rounded-lg border-2 border-accent p-4 font-medium">
          The architect was added.
        </p>
      )}
      <ArchitectForm
        action={saveArchitectAction}
        architectId={architect.id}
        initial={{
          name: architect.name,
          slug: architect.slug,
          websiteUrl: architect.websiteUrl ?? "",
          bio: architect.bio ?? "",
        }}
      />
    </>
  );
}
