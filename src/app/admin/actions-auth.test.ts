// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * A server action is a public HTTP endpoint: anyone who knows its id can call it, whether or not the
 * page that shows its button was ever rendered for them. So every admin action must refuse a
 * signed-out caller before it reads or writes anything. These tests replace requireAdmin() with one
 * that rejects (as the real one does, by redirecting), and make the database and storage throw if
 * they are touched at all. Each action must reject without reaching either.
 */

const touched = vi.hoisted(() => ({ db: 0, storage: 0 }));

vi.mock("@/server/auth/require-admin", () => ({
  requireAdmin: vi.fn(async () => {
    throw new Error("NEXT_REDIRECT");
  }),
  getAdmin: vi.fn(async () => null),
}));
vi.mock("@/server/db/client", () => ({
  getDb: () => {
    touched.db += 1;
    throw new Error("DATABASE TOUCHED");
  },
}));
vi.mock("@/server/storage", () => {
  const trap = async () => {
    touched.storage += 1;
    throw new Error("STORAGE TOUCHED");
  };
  return { deleteObjects: trap, downloadObject: trap, uploadPublic: trap, createUploadSlot: trap, listObjects: trap };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
}));

const ID = "11111111-1111-4111-8111-111111111111";
const form = () => {
  const data = new FormData();
  data.set("id", ID);
  data.set("imageId", ID);
  data.set("intent", "delete");
  data.set("title", "Hostile");
  return data;
};
const IDLE = { status: "idle" };

type Actions = Record<string, (...args: unknown[]) => Promise<unknown>>;

beforeEach(() => {
  touched.db = 0;
  touched.storage = 0;
});

/** Every action that must be admin-only: the file it lives in, its name, and a hostile call to it. */
const ADMIN_ACTIONS: Array<[string, string, (module: Actions) => Promise<unknown>]> = [
  ["projects/actions", "projectAction", (m) => m.projectAction!(IDLE, form())],
  ["projects/save-action", "saveProjectAction", (m) => m.saveProjectAction!(IDLE, form())],
  ["projects/image-actions", "imageAction", (m) => m.imageAction!(IDLE, form())],
  [
    "projects/image-actions",
    "attachImageAction",
    (m) => m.attachImageAction!(ID, "tmp/x/y", { alt: "a", caption: "", credit: "" }),
  ],
  ["architects/actions", "saveArchitectAction", (m) => m.saveArchitectAction!(IDLE, form())],
  ["architects/actions", "deleteArchitectAction", (m) => m.deleteArchitectAction!(IDLE, form())],
  ["messages/actions", "messageAction", (m) => m.messageAction!(IDLE, form())],
];

describe("every admin server action refuses a signed-out caller before touching anything", () => {
  it.each(ADMIN_ACTIONS)("%s: %s", async (file, _name, call) => {
    const actions = (await import(`./(protected)/${file}`)) as Actions;

    await expect(call(actions)).rejects.toThrow("NEXT_REDIRECT");

    expect(touched.db).toBe(0);
    expect(touched.storage).toBe(0);
  });
});

describe("no admin action escapes this test", () => {
  const root = path.resolve(import.meta.dirname);
  const actionFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) return actionFiles(full);
      const isSource = /\.tsx?$/.test(entry) && !/\.test\./.test(entry);
      return isSource && /^["']use server["']/.test(readFileSync(full, "utf8")) ? [full] : [];
    });
  const exportedActions = (file: string) =>
    [...readFileSync(file, "utf8").matchAll(/^export async function (\w+)/gm)].map((match) => match[1]!);

  /** Open to everyone by design: signing in requires being signed out, and signing out needs no rights. */
  const PUBLIC_BY_DESIGN = new Set(["login", "logout"]);

  it("covers every exported action in every admin server-action file", () => {
    const covered = new Set(ADMIN_ACTIONS.map(([, name]) => name));
    const found = actionFiles(root).flatMap(exportedActions);

    expect(found.length).toBeGreaterThanOrEqual(ADMIN_ACTIONS.length);
    const uncovered = found.filter((name) => !covered.has(name) && !PUBLIC_BY_DESIGN.has(name));
    expect(uncovered, `Admin actions missing from ADMIN_ACTIONS: ${uncovered.join(", ")}`).toEqual([]);
  });

  it("really calls requireAdmin() before reading input or data in each action", () => {
    for (const file of actionFiles(root)) {
      const source = readFileSync(file, "utf8");
      for (const name of exportedActions(file)) {
        if (PUBLIC_BY_DESIGN.has(name)) continue;
        const body = source.slice(source.indexOf(`export async function ${name}`));
        const firstCall = body.indexOf("await requireAdmin()");
        const positions = ["getDb(", "formData.get(", "deps()"].map((needle) => body.indexOf(needle));
        const firstData = Math.min(...positions.map((position) => (position === -1 ? Infinity : position)));
        expect(firstCall, `${path.basename(file)}: ${name} must call requireAdmin()`).toBeGreaterThan(-1);
        expect(firstCall, `${path.basename(file)}: ${name} must check the admin before reading input or data`).toBeLessThan(
          firstData,
        );
      }
    }
  });
});
