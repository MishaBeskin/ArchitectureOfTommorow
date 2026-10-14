"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/cn";
import type { MessageActionState } from "@/server/admin/handle-message-action";
import { MESSAGE_LIST_LIMIT, type AdminMessage } from "@/server/queries/admin-messages";

export type MessagesAction = (previous: MessageActionState, formData: FormData) => Promise<MessageActionState>;

const IDLE: MessageActionState = { status: "idle" };

// Fixed to UTC so the server and the browser print the same text (no hydration mismatch).
const formatDateTime = (date: Date) =>
  `${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date)} UTC`;

/** Only a plain address becomes a reply link; anything odd stays as text. */
const SAFE_EMAIL = /^[^\s@<>"',;:()[\]\\]+@[^\s@<>"',;:()[\]\\]+\.[^\s@<>"',;:()[\]\\]+$/;

export function MessagesList({
  messages,
  total,
  unhandled,
  action,
}: {
  messages: AdminMessage[];
  total: number;
  unhandled: number;
  action: MessagesAction;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const [deleting, setDeleting] = useState<AdminMessage | null>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  // Move focus to the outcome: after a delete the message that had focus no longer exists.
  useEffect(() => {
    if (state.status !== "idle") messageRef.current?.focus();
  }, [state]);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted">
        {total === 1 ? "1 message" : `${total} messages`} · {unhandled} new
        {total > messages.length && ` · showing the newest ${MESSAGE_LIST_LIMIT}`}
      </p>

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

      {messages.length === 0 ? (
        <p className="rounded-xl border border-border p-8 text-lg text-muted">
          No messages yet. Messages sent through the contact form appear here.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {messages.map((message) => {
            const handled = message.handledAt !== null;
            return (
              <li key={message.id} className="rounded-xl border border-border p-5">
                <article className="flex flex-col gap-3" aria-label={`Message from ${message.name}`}>
                  <header className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <h2 className="font-display text-xl">{message.name}</h2>
                    {/* Text and an outline carry the meaning; colour alone would fail for colour-blind users. */}
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium",
                        handled ? "border-border-strong text-muted" : "border-accent text-accent",
                      )}
                    >
                      {handled ? "Handled" : "New"}
                    </span>
                    <time dateTime={message.createdAt.toISOString()} className="text-sm text-muted">
                      {formatDateTime(message.createdAt)}
                    </time>
                  </header>
                  <p>
                    {SAFE_EMAIL.test(message.email) ? (
                      <a href={`mailto:${message.email}`} className="underline underline-offset-4">
                        {message.email}
                        <span className="sr-only"> (reply by email)</span>
                      </a>
                    ) : (
                      message.email
                    )}
                  </p>
                  {/* Plain text only: line breaks are kept, markup is never interpreted. */}
                  <p className="whitespace-pre-wrap break-words text-lg leading-8">{message.message}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={formAction}>
                      <input type="hidden" name="id" value={message.id} />
                      <Button
                        type="submit"
                        name="intent"
                        value={handled ? "new" : "handled"}
                        variant="secondary"
                        disabled={pending}
                        aria-label={`Mark the message from ${message.name} as ${handled ? "new" : "handled"}`}
                      >
                        {handled ? "Mark as new" : "Mark as handled"}
                      </Button>
                    </form>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={pending}
                      aria-label={`Delete the message from ${message.name}`}
                      onClick={() => setDeleting(message)}
                    >
                      Delete
                    </Button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this message?"
        description={
          deleting ? `The message from ${deleting.name} will be permanently removed. This cannot be undone.` : ""
        }
      >
        {deleting && (
          <form action={formAction} onSubmit={() => setDeleting(null)} className="contents">
            <input type="hidden" name="id" value={deleting.id} />
            <Button type="button" variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button type="submit" name="intent" value="delete" variant="danger">
              Delete message
            </Button>
          </form>
        )}
      </ConfirmDialog>
    </div>
  );
}
