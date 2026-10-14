// @vitest-environment node
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/test/db";
import { contactMessages } from "../db/schema";
import { listMessages } from "../queries/admin-messages";
import { handleMessageAction } from "./handle-message-action";

let db: TestDb;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(async () => {
  await close();
});
beforeEach(async () => {
  await db.delete(contactMessages);
});

async function add(name: string, overrides: Partial<typeof contactMessages.$inferInsert> = {}) {
  const [row] = await db
    .insert(contactMessages)
    .values({ name, email: `${name.toLowerCase()}@example.com`, message: `Hello from ${name}`, ...overrides })
    .returning();
  return row!;
}
const reload = async (id: string) => (await db.select().from(contactMessages).where(eq(contactMessages.id, id)))[0];

describe("handleMessageAction", () => {
  it("marks a message handled, stamping the time, and then new again", async () => {
    const message = await add("Ada");

    const handled = await handleMessageAction({ db }, { id: message.id, intent: "handled" });
    expect(handled).toEqual({ status: "success", message: "The message from Ada is marked as handled." });
    expect((await reload(message.id))!.handledAt).toBeInstanceOf(Date);

    const again = await handleMessageAction({ db }, { id: message.id, intent: "new" });
    expect(again).toEqual({ status: "success", message: "The message from Ada is marked as new." });
    expect((await reload(message.id))!.handledAt).toBeNull();
  });

  it("deletes a message", async () => {
    const message = await add("Ben");

    expect(await handleMessageAction({ db }, { id: message.id, intent: "delete" })).toEqual({
      status: "success",
      message: "The message from Ben was deleted.",
    });
    expect(await reload(message.id)).toBeUndefined();
  });

  it("changes only the chosen message", async () => {
    const [a, b] = [await add("Ada"), await add("Ben")];

    await handleMessageAction({ db }, { id: a.id, intent: "handled" });

    expect((await reload(b.id))!.handledAt).toBeNull();
  });

  it("rejects a bad id or intent without touching anything", async () => {
    const message = await add("Ada");

    for (const raw of [
      { id: "1; drop table contact_messages", intent: "delete" },
      { id: message.id, intent: "explode" },
      { id: message.id, intent: null },
      { id: null, intent: "delete" },
    ]) {
      expect(await handleMessageAction({ db }, raw)).toMatchObject({ status: "error" });
    }
    expect(await reload(message.id)).toBeDefined();
  });

  it("says when the message is already gone", async () => {
    for (const intent of ["handled", "new", "delete"]) {
      expect(await handleMessageAction({ db }, { id: randomUUID(), intent })).toMatchObject({
        status: "error",
        message: expect.stringContaining("no longer exists"),
      });
    }
  });
});

describe("listMessages", () => {
  it("lists newest first with counts, and never selects the hashed address or browser string", async () => {
    await add("Old", { createdAt: new Date("2026-01-01T10:00:00Z"), handledAt: new Date("2026-01-02T10:00:00Z") });
    await add("New", { createdAt: new Date("2026-03-01T10:00:00Z"), ipHash: "secret-hash", userAgent: "secret-agent" });

    const { messages, total, unhandled } = await listMessages(db);

    expect(messages.map((m) => m.name)).toEqual(["New", "Old"]);
    expect([total, unhandled]).toEqual([2, 1]);
    expect(Object.keys(messages[0]!).sort()).toEqual(["createdAt", "email", "handledAt", "id", "message", "name"]);
    expect(JSON.stringify(messages)).not.toContain("secret");
  });

  it("is empty with zero counts when there are no messages", async () => {
    expect(await listMessages(db)).toEqual({ messages: [], total: 0, unhandled: 0 });
  });
});
