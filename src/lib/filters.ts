import { PROJECT_TYPES, YEAR_RANGE, type ProjectFilters, type ProjectType } from "./types";

export const PAGE_SIZE = 12;
const MAX_PAGE = 1000;

/** Shape of Next's `searchParams` after awaiting it. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function isProjectType(value: string): value is ProjectType {
  return (PROJECT_TYPES as readonly string[]).includes(value);
}

/**
 * Turns untrusted URL params into valid filters. Anything unrecognised is dropped rather than
 * rejected, so a stale or hand-edited link still renders (with fewer filters) instead of erroring.
 */
export function parseProjectFilters(params: RawSearchParams): ProjectFilters {
  const filters: ProjectFilters = { page: 1 };

  const type = first(params.type)?.trim();
  if (type && isProjectType(type)) filters.type = type;

  const location = first(params.location)?.trim();
  if (location && /^[a-z]{2}$/i.test(location)) filters.location = location.toUpperCase();

  const year = first(params.year)?.trim();
  if (year && /^\d{4}$/.test(year)) {
    const value = Number(year);
    if (value >= YEAR_RANGE.min && value <= YEAR_RANGE.max) filters.year = value;
  }

  const page = first(params.page)?.trim();
  if (page && /^\d+$/.test(page)) {
    const value = Number(page);
    if (value >= 1 && value <= MAX_PAGE) filters.page = value;
  }

  return filters;
}

/** Canonical query string (no leading "?"): fixed key order, defaults omitted. */
export function serializeProjectFilters(filters: ProjectFilters): string {
  const query = new URLSearchParams();
  if (filters.type) query.set("type", filters.type);
  if (filters.location) query.set("location", filters.location);
  if (filters.year) query.set("year", String(filters.year));
  if (filters.page > 1) query.set("page", String(filters.page));
  return query.toString();
}

export function hasActiveFilters(filters: ProjectFilters): boolean {
  return Boolean(filters.type || filters.location || filters.year);
}
