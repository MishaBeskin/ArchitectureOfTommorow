import { eq } from "drizzle-orm";
import { contactMessages } from "../db/schema";
import type { AnyDb } from "../db/types";

export type MessageResult<T = object> = ({ ok: true } & T) | { ok: false; reason: "not-found" };

/** Marking handled stamps the time; marking new again clears it. Doing either twice is harmless. */
export async function setMessageHandled(
  db: AnyDb,
  id: string,
  handled: boolean,
): Promise<MessageResult<{ name: string; handled: boolean }>> {
  const [row] = await db
    .update(contactMessages)
    .set({ handledAt: handled ? new Date() : null })
    .where(eq(contactMessages.id, id))
    .returning({ name: contactMessages.name });
  return row ? { ok: true, name: row.name, handled } : { ok: false, reason: "not-found" };
}

export async function deleteMessage(db: AnyDb, id: string): Promise<MessageResult<{ name: string }>> {
  const [row] = await db
    .delete(contactMessages)
    .where(eq(contactMessages.id, id))
    .returning({ name: contactMessages.name });
  return row ? { ok: true, name: row.name } : { ok: false, reason: "not-found" };
}
