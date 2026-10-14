/** What the project form starts with: every field as the text the admin sees. */
export interface ProjectFormInitial {
  title: string;
  slug: string;
  summary: string;
  descriptionMd: string;
  type: string;
  phase: string;
  year: string;
  city: string;
  region: string;
  countryCode: string;
  lat: string;
  lng: string;
  seoTitle: string;
  seoDescription: string;
  credits: Array<{ architectId: string; role: string }>;
}

/** A blank form for a new project. The year is passed in so this stays a pure function. */
export function emptyProjectForm(year: number): ProjectFormInitial {
  return {
    title: "",
    slug: "",
    summary: "",
    descriptionMd: "",
    type: "",
    phase: "completed",
    year: String(year),
    city: "",
    region: "",
    countryCode: "",
    lat: "",
    lng: "",
    seoTitle: "",
    seoDescription: "",
    credits: [],
  };
}

interface ProjectRowLike {
  title: string;
  slug: string;
  summary: string;
  descriptionMd: string;
  type: string;
  phase: string;
  year: number;
  city: string;
  region: string | null;
  countryCode: string;
  lat: number | null;
  lng: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

/** A saved project as form text: empty values become "", numbers become digits. */
export function projectToFormInitial(
  row: ProjectRowLike,
  credits: Array<{ architectId: string; role: string | null }>,
): ProjectFormInitial {
  return {
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    descriptionMd: row.descriptionMd,
    type: row.type,
    phase: row.phase,
    year: String(row.year),
    city: row.city,
    region: row.region ?? "",
    countryCode: row.countryCode,
    lat: row.lat === null ? "" : String(row.lat),
    lng: row.lng === null ? "" : String(row.lng),
    seoTitle: row.seoTitle ?? "",
    seoDescription: row.seoDescription ?? "",
    credits: credits.map((credit) => ({ architectId: credit.architectId, role: credit.role ?? "" })),
  };
}

/**
 * The form after a failed save: the text the admin typed, which the server sent back untouched.
 * Anything missing or not text falls back to the empty string, so an odd value cannot break the page.
 */
export function formFromSubmittedValues(values: Record<string, unknown>): ProjectFormInitial {
  const text = (name: string) => (typeof values[name] === "string" ? (values[name] as string) : "");
  const credits = Array.isArray(values.architects)
    ? values.architects.flatMap((item: unknown) => {
        if (typeof item !== "object" || item === null) return [];
        const { architectId, role } = item as Record<string, unknown>;
        return typeof architectId === "string" ? [{ architectId, role: typeof role === "string" ? role : "" }] : [];
      })
    : [];

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
    credits,
  };
}
