import { z } from "zod";
import "./zod-config";

/** Formats accepted for upload. SVG is deliberately absent: it can carry scripts. */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const IMAGE_ACCEPT = IMAGE_TYPES.join(",");

export const IMAGE_LIMITS = {
  /** Largest original accepted. The storage bucket enforces the same number. */
  maxBytes: 30 * 1024 * 1024,
  /** Longest side kept after processing; the original is never stored. */
  maxSide: 2400,
  /** Refuse enormous pictures before decoding them (decompression-bomb guard). */
  maxPixels: 100_000_000,
  perProject: 40,
  alt: 300,
  caption: 300,
  credit: 150,
} as const;

export const isImageType = (type: string): boolean => (IMAGE_TYPES as readonly string[]).includes(type);

const blankToNull = (value: unknown) => (typeof value === "string" && value.trim() === "" ? null : value);

const optional = (max: number, label: string) =>
  z.preprocess(blankToNull, z.string().trim().max(max, `${label} must be ${max} characters or fewer.`).nullable());

/** Alt text is always required, so no image can ever be public without a description. */
export const imageMetaSchema = z.object({
  alt: z
    .string()
    .trim()
    .min(1, "Describe the image for people who cannot see it.")
    .max(IMAGE_LIMITS.alt, `Description must be ${IMAGE_LIMITS.alt} characters or fewer.`),
  caption: optional(IMAGE_LIMITS.caption, "Caption"),
  credit: optional(IMAGE_LIMITS.credit, "Credit"),
});

export type ImageMeta = z.output<typeof imageMetaSchema>;
export type ImageMetaErrors = Partial<Record<keyof ImageMeta, string>>;

export function parseImageMeta(raw: unknown): { ok: true; data: ImageMeta } | { ok: false; errors: ImageMetaErrors } {
  const result = imageMetaSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  const errors: ImageMetaErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof ImageMeta | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { ok: false, errors };
}

/** Where a browser upload waits until the server has checked and re-encoded it. */
export const tempPath = (projectId: string, uploadId: string) => `tmp/${projectId}/${uploadId}`;

const TEMP_PATH = /^tmp\/([0-9a-f-]{36})\/([0-9a-f-]{36})$/;

/** The project and upload ids in a temp path, or null if it is not exactly one. */
export function parseTempPath(path: string): { projectId: string; uploadId: string } | null {
  const match = TEMP_PATH.exec(path);
  return match ? { projectId: match[1]!, uploadId: match[2]! } : null;
}

/** Final location: by project id, never slug, so renaming a project cannot orphan its files. */
export const imagePath = (projectId: string, imageId: string) => `projects/${projectId}/${imageId}.webp`;
