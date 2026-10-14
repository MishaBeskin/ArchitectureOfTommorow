import { z } from "zod";
import { isCountryCode } from "./countries";
import { SLUG_MAX_LENGTH, isValidSlug } from "./slug";
import { PROJECT_PHASES, PROJECT_TYPES, YEAR_RANGE } from "./types";

export const PROJECT_LIMITS = {
  title: 120,
  summary: 300,
  description: 20_000,
  city: 100,
  region: 100,
  seoTitle: 70,
  seoDescription: 160,
  role: 100,
} as const;

/** Blank text in a form means "not given": null, not an empty string. */
const blankToNull = (value: unknown) => (typeof value === "string" && value.trim() === "" ? null : value);

const optionalText = (max: number, label: string) =>
  z.preprocess(blankToNull, z.string().trim().max(max, `${label} must be ${max} characters or fewer.`).nullable());

/** A number typed into a text box arrives as a string; blank is null and anything else must parse. */
const optionalNumber = (label: string, min: number, max: number) =>
  z.preprocess(
    (value) => {
      const v = blankToNull(value);
      return typeof v === "string" ? Number(v) : v;
    },
    z
      .number({ error: `${label} must be a number.` })
      .min(min, `${label} must be between ${min} and ${max}.`)
      .max(max, `${label} must be between ${min} and ${max}.`)
      .nullable(),
  );

const architectCredit = z.object({
  architectId: z.uuid("Choose an architect from the list."),
  role: optionalText(PROJECT_LIMITS.role, "Role"),
});

export const projectInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Enter a title.")
      .max(PROJECT_LIMITS.title, `Title must be ${PROJECT_LIMITS.title} characters or fewer.`),
    slug: z
      .string()
      .trim()
      .min(1, "Enter a web address.")
      .refine(isValidSlug, {
        error: `Use lower-case letters, numbers and single hyphens, up to ${SLUG_MAX_LENGTH} characters.`,
      }),
    // May be empty on a draft; the publish rules ask for it before the project goes public.
    summary: z.string().trim().max(PROJECT_LIMITS.summary, `Summary must be ${PROJECT_LIMITS.summary} characters or fewer.`),
    descriptionMd: z
      .string()
      .max(PROJECT_LIMITS.description, `Description must be ${PROJECT_LIMITS.description} characters or fewer.`),
    type: z.enum(PROJECT_TYPES, { error: "Choose a type." }),
    phase: z.enum(PROJECT_PHASES, { error: "Choose a stage." }),
    year: z.preprocess(
      (value) => (typeof value === "string" ? (value.trim() === "" ? Number.NaN : Number(value)) : value),
      z
        .number({ error: "Enter a year." })
        .int("Enter a whole year.")
        .min(YEAR_RANGE.min, `Enter a year between ${YEAR_RANGE.min} and ${YEAR_RANGE.max}.`)
        .max(YEAR_RANGE.max, `Enter a year between ${YEAR_RANGE.min} and ${YEAR_RANGE.max}.`),
    ),
    city: z
      .string()
      .trim()
      .min(1, "Enter a city.")
      .max(PROJECT_LIMITS.city, `City must be ${PROJECT_LIMITS.city} characters or fewer.`),
    region: optionalText(PROJECT_LIMITS.region, "Region"),
    countryCode: z.string().trim().refine(isCountryCode, { error: "Choose a country." }),
    lat: optionalNumber("Latitude", -90, 90),
    lng: optionalNumber("Longitude", -180, 180),
    seoTitle: optionalText(PROJECT_LIMITS.seoTitle, "Search title"),
    seoDescription: optionalText(PROJECT_LIMITS.seoDescription, "Search description"),
    architects: z.array(architectCredit),
  })
  .superRefine((value, ctx) => {
    if ((value.lat === null) !== (value.lng === null)) {
      ctx.addIssue({
        code: "custom",
        path: [value.lat === null ? "lat" : "lng"],
        message: "Give both latitude and longitude, or leave both empty.",
      });
    }
    const ids = value.architects.map((architect) => architect.architectId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", path: ["architects"], message: "Each architect can be credited only once." });
    }
  });

export type ProjectInput = z.output<typeof projectInputSchema>;
export type ProjectField = keyof ProjectInput;
export type ProjectFieldErrors = Partial<Record<ProjectField, string>>;

export type ParsedProject = { ok: true; data: ProjectInput } | { ok: false; errors: ProjectFieldErrors };

/** Validates untrusted input. Reports the first problem for each field, keyed by field name. */
export function parseProjectInput(raw: unknown): ParsedProject {
  const result = projectInputSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };

  const errors: ProjectFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as ProjectField | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { ok: false, errors };
}

/** Reads the project form's fields into the plain object the schema validates. */
export function formDataToProjectInput(data: FormData): Record<string, unknown> {
  const text = (name: string) => {
    const value = data.get(name);
    return typeof value === "string" ? value : "";
  };

  const architects = data
    .getAll("architectId")
    .filter((id): id is string => typeof id === "string")
    .map((architectId) => ({ architectId, role: text(`role-${architectId}`) }));

  return {
    title: text("title"),
    slug: text("slug"),
    summary: text("summary"),
    descriptionMd: text("descriptionMd"),
    type: text("type"),
    phase: text("phase"),
    year: text("year"),
    city: text("city"),
    region: text("region"),
    countryCode: text("countryCode"),
    lat: text("lat"),
    lng: text("lng"),
    seoTitle: text("seoTitle"),
    seoDescription: text("seoDescription"),
    architects,
  };
}
