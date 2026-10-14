"use server";

import { revalidatePath } from "next/cache";
import { handleMessageAction, type MessageActionState } from "@/server/admin/handle-message-action";
import { requireAdmin } from "@/server/auth/require-admin";
import { getDb } from "@/server/db/client";

/**
 * Every button in the inbox posts here. requireAdmin() comes first and is the real check: a server
 * action is a public endpoint that anyone can call. Messages are never shown on the public site,
 * so there is no public cache to expire.
 */
export async function messageAction(_previous: MessageActionState, formData: FormData): Promise<MessageActionState> {
  await requireAdmin();

  try {
    const result = await handleMessageAction(
      { db: getDb() },
      { id: formData.get("id"), intent: formData.get("intent") },
    );
    if (result.status === "success") revalidatePath("/admin/messages");
    return result;
  } catch (error) {
    console.error("Message action failed", error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}
