import type { ProjectCardData, ProjectImage } from "@/lib/types";

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
