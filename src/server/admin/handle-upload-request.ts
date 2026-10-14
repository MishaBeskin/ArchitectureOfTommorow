import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { IMAGE_LIMITS, isImageType, tempPath } from "@/lib/image-rules";
import { projectImages, projects } from "../db/schema";
import type { AnyDb } from "../db/types";

export type UploadRequestResult =
  | { status: 200; body: { path: string; token: string } }
  | { status: 400 | 404 | 409; body: { error: string } };

const requestSchema = z.object({
  projectId: z.uuid(),
  contentType: z.string().max(100),
  size: z.number().int().positive(),
});

export interface UploadRequestDeps {
  db: AnyDb;
  createSlot: (path: string) => Promise<{ path: string; token: string }>;
  newId: () => string;
}

/**
 * Decides whether the browser may send a file, before it sends it: the project must exist and have
 * room, and the file must claim to be an image of acceptable size. The claim is only a first
 * filter, since the bucket enforces the same limits and the server re-checks the actual bytes.
 * The caller has already checked the admin.
 */
export async function handleUploadRequest(deps: UploadRequestDeps, raw: unknown): Promise<UploadRequestResult> {
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "That request was not valid." } };
  const { projectId, contentType, size } = parsed.data;

  if (!isImageType(contentType)) {
    return { status: 400, body: { error: "Only JPEG, PNG, WebP and AVIF images are accepted." } };
  }
  if (size > IMAGE_LIMITS.maxBytes) return { status: 400, body: { error: "The file is larger than 30 MB." } };

  const [project] = await deps.db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return { status: 404, body: { error: "That project no longer exists." } };

  const [row] = await deps.db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectImages)
    .where(eq(projectImages.projectId, projectId));
  if ((row?.count ?? 0) >= IMAGE_LIMITS.perProject) {
    return { status: 409, body: { error: "This project already has the most images allowed. Delete one first." } };
  }

  return { status: 200, body: await deps.createSlot(tempPath(projectId, deps.newId())) };
}
