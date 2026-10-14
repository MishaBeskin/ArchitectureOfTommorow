import { desc, sql } from "drizzle-orm";
import { contactMessages } from "../db/schema";
import type { AnyDb } from "../db/types";

export interface AdminMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: Date;
  handledAt: Date | null;
}

export const MESSAGE_LIST_LIMIT = 200;

/**
 * Newest first, and only what the inbox shows. The hashed address and browser string kept for abuse
 * handling are deliberately not selected, so they can never reach a page. Admin only: never public.
 */
export async function listMessages(db: AnyDb): Promise<{ messages: AdminMessage[]; total: number; unhandled: number }> {
  const messages = await db
    .select({
      id: contactMessages.id,
      name: contactMessages.name,
      email: contactMessages.email,
      message: contactMessages.message,
      createdAt: contactMessages.createdAt,
      handledAt: contactMessages.handledAt,
    })
    .from(contactMessages)
    .orderBy(desc(contactMessages.createdAt))
    .limit(MESSAGE_LIST_LIMIT);

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      unhandled: sql<number>`count(*) filter (where ${contactMessages.handledAt} is null)::int`,
    })
    .from(contactMessages);

  return { messages, total: counts?.total ?? 0, unhandled: counts?.unhandled ?? 0 };
}
