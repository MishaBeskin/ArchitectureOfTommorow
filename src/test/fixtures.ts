import type { Project, ProjectCardData, ProjectImage } from "@/lib/types";

export function imageFixture(overrides: Partial<ProjectImage> = {}): ProjectImage {
  return {
    id: "img-1",
    url: "https://storage.test/storage/v1/object/public/projects/seed/demo/1.webp",
    pathname: "seed/demo/1.webp",
    width: 1600,
    height: 1000,
    alt: "Facade at dusk",
    caption: null,
    credit: null,
    blurDataUrl: "data:image/webp;base64,AAAA",
    sortOrder: 0,
    ...overrides,
  };
}

export function projectFixture(overrides: Partial<Project> = {}): Project {
  const images = [imageFixture({ id: "img-1" }), imageFixture({ id: "img-2", sortOrder: 1 })];
  return {
    id: "project-1",
    slug: "harbour-light-library",
    title: "Harbour Light Library",
    summary: "A public library on the waterfront.",
    descriptionMd: "A first paragraph.\n\nA second paragraph.",
    type: "cultural",
    phase: "completed",
    year: 2025,
    location: { city: "Copenhagen", region: null, countryCode: "DK", lat: null, lng: null },
    architects: [
      { id: "a1", slug: "studio-nordlys", name: "Studio Nordlys", websiteUrl: null, bio: null, role: "Lead architect" },
    ],
    images,
    coverImage: images[0] ?? null,
    featured: false,
    featuredOrder: null,
    status: "published",
    seoTitle: null,
    seoDescription: null,
    publishedAt: new Date("2025-01-01"),
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

export function cardFixture(overrides: Partial<ProjectCardData> = {}): ProjectCardData {
  return {
    slug: "harbour-light-library",
    title: "Harbour Light Library",
    type: "cultural",
    year: 2025,
    location: { city: "Copenhagen", region: null, countryCode: "DK", lat: null, lng: null },
    cover: imageFixture(),
    architectNames: ["Studio Nordlys"],
    ...overrides,
  };
}
