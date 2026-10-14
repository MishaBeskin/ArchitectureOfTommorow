import { z } from "zod";
import "./zod-config";
import { SLUG_MAX_LENGTH, isValidSlug } from "./slug";

export const ARCHITECT_LIMITS = { name: 120, websiteUrl: 300, bio: 2000 } as const;

const blankToNull = (value: unknown) => (typeof value === "string" && value.trim() === "" ? null : value);

/**
 * Only http(s) addresses: the site shows this as a link, and "javascript:" or "data:" addresses
 * must never reach an href.
 */
const isWebAddress = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

export const architectInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a name.")
    .max(ARCHITECT_LIMITS.name, `Name must be ${ARCHITECT_LIMITS.name} characters or fewer.`),
  slug: z
    .string()
    .trim()
    .min(1, "Enter a web address.")
    .refine(isValidSlug, {
      error: `Use lower-case letters, numbers and single hyphens, up to ${SLUG_MAX_LENGTH} characters.`,
    }),
  websiteUrl: z.preprocess(
    blankToNull,
    z
      .string()
      .trim()
      .max(ARCHITECT_LIMITS.websiteUrl, `Website must be ${ARCHITECT_LIMITS.websiteUrl} characters or fewer.`)
      .refine(isWebAddress, { error: "Enter a full website address starting with https://" })
      .nullable(),
  ),
  bio: z.preprocess(
    blankToNull,
    z.string().trim().max(ARCHITECT_LIMITS.bio, `Biography must be ${ARCHITECT_LIMITS.bio} characters or fewer.`).nullable(),
  ),
});

export type ArchitectInput = z.output<typeof architectInputSchema>;
export type ArchitectField = keyof ArchitectInput;
export type ArchitectFieldErrors = Partial<Record<ArchitectField, string>>;

export type ParsedArchitect = { ok: true; data: ArchitectInput } | { ok: false; errors: ArchitectFieldErrors };

export function parseArchitectInput(raw: unknown): ParsedArchitect {
  const result = architectInputSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };

  const errors: ArchitectFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as ArchitectField | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { ok: false, errors };
}

export function formDataToArchitectInput(data: FormData): Record<string, unknown> {
  const text = (name: string) => {
    const value = data.get(name);
    return typeof value === "string" ? value : "";
  };
  return { name: text("name"), slug: text("slug"), websiteUrl: text("websiteUrl"), bio: text("bio") };
}
