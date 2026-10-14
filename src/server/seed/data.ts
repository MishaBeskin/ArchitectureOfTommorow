import type { ProjectPhase, ProjectStatus, ProjectType } from "@/lib/types";

export interface SeedArchitect {
  slug: string;
  name: string;
  websiteUrl?: string;
}

export interface SeedProject {
  slug: string;
  title: string;
  summary: string;
  descriptionMd: string;
  type: ProjectType;
  phase: ProjectPhase;
  status: ProjectStatus;
  year: number;
  city: string;
  region?: string;
  countryCode: string;
  lat: number;
  lng: number;
  featured?: boolean;
  featuredOrder?: number;
  architects: Array<{ slug: string; role?: string }>;
  imageCount: number;
  /** Earlier slugs that must keep working and redirect (308) to this project. */
  previousSlugs?: string[];
}

/** Everything seeded is stored under this prefix so it can be removed in one sweep. */
export const SEED_PREFIX = "seed";

const NOTE = "\n\n*Sample project: placeholder content for development. Not a real building.*";

export const SEED_ARCHITECTS: SeedArchitect[] = [
  { slug: "studio-nordlys", name: "Studio Nordlys" },
  { slug: "atelier-vento", name: "Atelier Vento" },
  { slug: "kaze-architects", name: "Kaze Architects" },
  { slug: "ubuntu-design-collective", name: "Ubuntu Design Collective" },
  { slug: "casa-aurora", name: "Casa Aurora" },
  { slug: "southern-cross-studio", name: "Southern Cross Studio" },
  { slug: "delta-office", name: "Delta Office" },
  { slug: "cascadia-works", name: "Cascadia Works" },
];

export const SEED_PROJECTS: SeedProject[] = [
  {
    slug: "harbour-light-library",
    title: "Harbour Light Library",
    summary: "A public library whose stepped reading terraces open the waterfront to the city.",
    descriptionMd: `Harbour Light Library turns a former customs shed into a public reading room. Timber terraces step down to the water, so the building doubles as a seating area for the whole quarter.\n\nDaylight reaches the stacks through a sawtooth roof, and the upper floor is arranged as a continuous loop of study spaces.${NOTE}`,
    type: "cultural",
    phase: "completed",
    status: "published",
    year: 2025,
    city: "Copenhagen",
    countryCode: "DK",
    lat: 55.6761,
    lng: 12.5683,
    featured: true,
    featuredOrder: 1,
    architects: [{ slug: "studio-nordlys", role: "Lead architect" }],
    imageCount: 4,
    previousSlugs: ["harbour-library"],
  },
  {
    slug: "terrace-houses-alfama",
    title: "Terrace Houses, Alfama",
    summary: "Twelve family homes stacked along a hillside, each with a private roof garden.",
    descriptionMd: `The scheme follows the contours of the hill, with each home offset from the one below to leave room for a roof garden.\n\nLocal limestone and lime render tie the project to its neighbours, while deep reveals keep the interiors cool through summer.${NOTE}`,
    type: "residential",
    phase: "completed",
    status: "published",
    year: 2024,
    city: "Lisbon",
    countryCode: "PT",
    lat: 38.7139,
    lng: -9.1334,
    featured: true,
    featuredOrder: 2,
    architects: [{ slug: "atelier-vento", role: "Lead architect" }, { slug: "casa-aurora", role: "Landscape" }],
    imageCount: 3,
  },
  {
    slug: "kansai-timber-school",
    title: "Kansai Timber School",
    summary: "A primary school built from cross-laminated timber around a central courtyard.",
    descriptionMd: `Classrooms wrap a courtyard that works as an outdoor corridor, a play area and a rainwater garden.\n\nThe structure is exposed cross-laminated timber throughout, and every classroom has two sides of natural light.${NOTE}`,
    type: "education",
    phase: "completed",
    status: "published",
    year: 2023,
    city: "Osaka",
    countryCode: "JP",
    lat: 34.6937,
    lng: 135.5023,
    featured: true,
    featuredOrder: 3,
    architects: [{ slug: "kaze-architects", role: "Lead architect" }],
    imageCount: 3,
  },
  {
    slug: "savanna-civic-hall",
    title: "Savanna Civic Hall",
    summary: "A naturally ventilated town hall with a wide shaded forecourt for markets and meetings.",
    descriptionMd: `The hall is organised around a deep, shaded forecourt that hosts a weekly market. A louvred roof draws air through the council chamber without air conditioning.\n\nBrick was made on site from local clay, which kept costs down and trained a local workforce.${NOTE}`,
    type: "civic",
    phase: "in-progress",
    status: "published",
    year: 2026,
    city: "Nairobi",
    countryCode: "KE",
    lat: -1.2921,
    lng: 36.8219,
    architects: [{ slug: "ubuntu-design-collective", role: "Lead architect" }],
    imageCount: 3,
  },
  {
    slug: "casa-jacaranda-hotel",
    title: "Casa Jacaranda Hotel",
    summary: "A 40-room boutique hotel wrapped around a courtyard planted with jacaranda trees.",
    descriptionMd: `Rooms open onto shared galleries that look into a central courtyard. Existing trees shaped the plan, and the building steps back to keep them.\n\nThe interiors use pigmented plaster and recycled tile in a palette drawn from the blossom.${NOTE}`,
    type: "hospitality",
    phase: "completed",
    status: "published",
    year: 2022,
    city: "Mexico City",
    countryCode: "MX",
    lat: 19.4326,
    lng: -99.1332,
    architects: [{ slug: "casa-aurora", role: "Lead architect" }],
    imageCount: 4,
  },
  {
    slug: "yarra-market-quarter",
    title: "Yarra Market Quarter",
    summary: "A mixed-use block combining a covered market, offices and apartments above.",
    descriptionMd: `A new covered market sits at street level, with offices and apartments in slim volumes above. Gaps between the volumes bring light and breeze down to the market floor.\n\nThe project reuses the steel frame of the old warehouse that stood on the site.${NOTE}`,
    type: "mixed-use",
    phase: "concept",
    status: "published",
    year: 2027,
    city: "Melbourne",
    countryCode: "AU",
    lat: -37.8136,
    lng: 144.9631,
    architects: [{ slug: "southern-cross-studio", role: "Lead architect" }],
    imageCount: 3,
  },
  {
    slug: "delta-flood-park",
    title: "Delta Flood Park",
    summary: "A public park designed to hold stormwater, turning flood defence into a place to gather.",
    descriptionMd: `The park is a series of terraced basins that fill during heavy rain and stay dry and usable the rest of the year.\n\nPlanting was chosen for tolerance of both wet and dry spells, and paths rise above the typical water line.${NOTE}`,
    type: "landscape",
    phase: "completed",
    status: "published",
    year: 2021,
    city: "Rotterdam",
    countryCode: "NL",
    lat: 51.9244,
    lng: 4.4777,
    architects: [{ slug: "delta-office", role: "Lead architect" }],
    imageCount: 3,
  },
  {
    slug: "cascadia-transit-hub",
    title: "Cascadia Transit Hub",
    summary: "A rail and bus interchange under a single timber canopy.",
    descriptionMd: `One continuous canopy of glulam arches shelters platforms, bus bays and a public plaza. Passengers see their connection from the moment they arrive.\n\nPhotovoltaic panels on the canopy supply most of the station's energy.${NOTE}`,
    type: "infrastructure",
    phase: "in-progress",
    status: "published",
    year: 2026,
    city: "Vancouver",
    region: "British Columbia",
    countryCode: "CA",
    lat: 49.2827,
    lng: -123.1207,
    architects: [{ slug: "cascadia-works", role: "Lead architect" }],
    imageCount: 3,
  },
  {
    slug: "unpublished-draft-pavilion",
    title: "Draft Pavilion (unpublished)",
    summary: "A draft entry used to check that unpublished projects never appear on the public site.",
    descriptionMd: `This project is a draft and must not be visible on any public page.${NOTE}`,
    type: "commercial",
    phase: "concept",
    status: "draft",
    year: 2025,
    city: "Copenhagen",
    countryCode: "DK",
    lat: 55.6761,
    lng: 12.5683,
    architects: [{ slug: "studio-nordlys" }],
    imageCount: 1,
  },
];
