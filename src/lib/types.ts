export const PROJECT_TYPES = [
  "residential",
  "commercial",
  "cultural",
  "civic",
  "education",
  "hospitality",
  "mixed-use",
  "landscape",
  "infrastructure",
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_PHASES = ["concept", "in-progress", "completed"] as const;
export type ProjectPhase = (typeof PROJECT_PHASES)[number];

export const PROJECT_STATUSES = ["draft", "published"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface Architect {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string | null;
  bio: string | null;
}

export interface ProjectImage {
  id: string;
  /** Public URL served through next/image. */
  url: string;
  /** Storage object path, used to delete the file. */
  pathname: string;
  width: number;
  height: number;
  alt: string;
  caption: string | null;
  credit: string | null;
  /** Tiny base64 placeholder shown while the image loads. */
  blurDataUrl: string;
  sortOrder: number;
}

export interface Location {
  city: string;
  region: string | null;
  /** ISO 3166-1 alpha-2, upper case. */
  countryCode: string;
  lat: number | null;
  lng: number | null;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  summary: string;
  descriptionMd: string;
  type: ProjectType;
  phase: ProjectPhase;
  year: number;
  location: Location;
  architects: Array<Architect & { role: string | null }>;
  images: ProjectImage[];
  coverImage: ProjectImage | null;
  featured: boolean;
  featuredOrder: number | null;
  status: ProjectStatus;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** What list pages and cards need; avoids loading descriptions and full galleries. */
export type ProjectCardData = Pick<Project, "slug" | "title" | "type" | "year" | "location"> & {
  cover: ProjectImage | null;
  architectNames: string[];
};

export interface ProjectFilters {
  type?: ProjectType;
  /** ISO 3166-1 alpha-2 country code. */
  location?: string;
  year?: number;
  page: number;
}

export interface FilterOptions {
  types: ProjectType[];
  locations: Array<{ code: string; label: string; count: number }>;
  years: number[];
}

export const YEAR_RANGE = { min: 1900, max: 2100 } as const;
