import type { Metadata } from "next";
import { Suspense } from "react";
import { MessagesList } from "@/components/admin/messages-list";
import { requireAdmin } from "@/server/auth/require-admin";
import { getDb } from "@/server/db/client";
import { listMessages } from "@/server/queries/admin-messages";
import { messageAction } from "./actions";

export const metadata: Metadata = { title: "Messages" };

export default function AdminMessagesPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-4xl font-medium">Messages</h1>
      <Suspense fallback={<p role="status" className="text-muted">Loading messages…</p>}>
        <AdminMessages />
      </Suspense>
    </div>
  );
}

async function AdminMessages() {
  // Every admin page checks for itself; the layout's check is not enough on its own.
  await requireAdmin();
  // Live, uncached read: new messages must show up the moment they arrive.
  const { messages, total, unhandled } = await listMessages(getDb());

  return <MessagesList messages={messages} total={total} unhandled={unhandled} action={messageAction} />;
}
