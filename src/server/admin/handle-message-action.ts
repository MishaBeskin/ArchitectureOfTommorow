import { z } from "zod";
import type { AnyDb } from "../db/types";
import { deleteMessage, setMessageHandled } from "../mutations/messages";

export type MessageActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const inputSchema = z.object({
  id: z.uuid(),
  intent: z.enum(["handled", "new", "delete"]),
});

/** One handler for every button in the inbox. The caller has already checked the admin. */
export async function handleMessageAction(
  deps: { db: AnyDb },
  raw: { id: unknown; intent: unknown },
): Promise<MessageActionState> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", message: "That request was not valid. Please reload the page and try again." };
  }
  const { id, intent } = parsed.data;
  const gone: MessageActionState = {
    status: "error",
    message: "That message no longer exists. Reload the page to see the current list.",
  };

  if (intent === "delete") {
    const result = await deleteMessage(deps.db, id);
    return result.ok ? { status: "success", message: `The message from ${result.name} was deleted.` } : gone;
  }

  const result = await setMessageHandled(deps.db, id, intent === "handled");
  if (!result.ok) return gone;
  return {
    status: "success",
    message: result.handled
      ? `The message from ${result.name} is marked as handled.`
      : `The message from ${result.name} is marked as new.`,
  };
}
