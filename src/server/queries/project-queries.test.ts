// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PROJECT_TYPES } from "@/lib/types";
import { createTestDb, type TestDb } from "@/test/db";
import { projects, projectSlugRedirects } from "../db/schema";
import { SEED_PROJECTS } from "../seed/data";
import { seedDatabase } from "../seed/seed";
import {
  getFeaturedProjects,
  getFilterOptions,
  getProjectPage,
  getPublishedSlugs,
  getRelatedProjects,
  getSitemapEntries,
  listProjects,
} from "./project-queries";

let db: TestDb;
let close: () => Promise<void>;

const PUBLISHED = SEED_PROJECTS.filter((p) => p.status === "published");
const DRAFT_SLUG = "unpublished-draft-pavilion";

// Migrating plus rendering 27 placeholder images is slow when test files run in parallel.
beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedDatabase(db, async (pathname) => `https://storage.test/${pathname}`);
}, 60_000);

afterAll(async () => {
  await close();
});

const slugs = (items: { slug: string }[]) => items.map((i) => i.slug);

describe("getFeaturedProjects", () => {
  it("returns published featured projects in featuredOrder", async () => {
    const featured = await getFeaturedProjects(db);

    expect(slugs(featured)).toEqual(["harbour-light-library", "terrace-houses-alfama", "kansai-timber-school"]);
  });

  it("respects the limit", async () => {
    expect(await getFeaturedProjects(db, 2)).toHaveLength(2);
  });

  it("includes the cover image and architect names for cards", async () => {
    const [first] = await getFeaturedProjects(db);

    expect(first!.cover?.url).toBe("https://storage.test/seed/harbour-light-library/1.webp");
    expect(first!.architectNames).toEqual(["Studio Nordlys"]);
  });

  it("never returns a draft, even if it is featured", async () => {
    await db.update(projects).set({ featured: true, featuredOrder: 0 }).where(eq(projects.slug, DRAFT_SLUG));

    expect(slugs(await getFeaturedProjects(db, 50))).not.toContain(DRAFT_SLUG);

    await db.update(projects).set({ featured: false, featuredOrder: null }).where(eq(projects.slug, DRAFT_SLUG));
  });
});

describe("listProjects", () => {
  it("lists every published project and hides drafts", async () => {
    const result = await listProjects(db, { page: 1 }, 50);

    expect(result.total).toBe(PUBLISHED.length);
    expect(slugs(result.items)).not.toContain(DRAFT_SLUG);
  });

  it("sorts newest year first", async () => {
    const { items } = await listProjects(db, { page: 1 }, 50);
    const years = items.map((i) => i.year);

    expect(years).toEqual([...years].sort((a, b) => b - a));
  });

  it("filters by type", async () => {
    const { items } = await listProjects(db, { page: 1, type: "residential" });

    expect(slugs(items)).toEqual(["terrace-houses-alfama"]);
  });

  it("filters by country", async () => {
    const { items } = await listProjects(db, { page: 1, location: "JP" });

    expect(slugs(items)).toEqual(["kansai-timber-school"]);
  });

  it("filters by year", async () => {
    const { items } = await listProjects(db, { page: 1, year: 2026 });

    expect(slugs(items).sort()).toEqual(["cascadia-transit-hub", "savanna-civic-hall"]);
  });

  it("combines filters with AND", async () => {
    expect((await listProjects(db, { page: 1, year: 2026, type: "civic" })).total).toBe(1);
    expect((await listProjects(db, { page: 1, year: 2026, type: "cultural" })).total).toBe(0);
  });

  it("does not leak the draft through a filter that only it matches", async () => {
    const result = await listProjects(db, { page: 1, type: "commercial" });

    expect(result).toMatchObject({ items: [], total: 0, page: 1, pageCount: 1 });
  });

  it("paginates without overlap and covers every project", async () => {
    const pages = [];
    for (let page = 1; page <= 3; page++) pages.push(await listProjects(db, { page }, 3));

    expect(pages.map((p) => p.items.length)).toEqual([3, 3, 2]);
    expect(pages.every((p) => p.pageCount === 3 && p.total === PUBLISHED.length)).toBe(true);
    const all = pages.flatMap((p) => slugs(p.items));
    expect(new Set(all).size).toBe(PUBLISHED.length);
  });

  it("clamps a page past the end to the last page", async () => {
    const result = await listProjects(db, { page: 99 }, 3);

    expect(result.page).toBe(3);
    expect(result.items).toHaveLength(2);
  });

  it("returns cards with covers and credits in order", async () => {
    const { items } = await listProjects(db, { page: 1, location: "PT" });

    expect(items[0]).toMatchObject({
      slug: "terrace-houses-alfama",
      location: { city: "Lisbon", countryCode: "PT" },
      architectNames: ["Atelier Vento", "Casa Aurora"],
    });
    expect(items[0]!.cover).not.toBeNull();
  });
});

describe("getProjectPage", () => {
  it("returns the full project with ordered images, credits and cover", async () => {
    const result = await getProjectPage(db, "terrace-houses-alfama");

    expect(result.kind).toBe("found");
    if (result.kind !== "found") return;
    const { project } = result;
    expect(project.images.map((i) => i.sortOrder)).toEqual([0, 1, 2]);
    expect(project.coverImage?.id).toBe(project.images[0]!.id);
    expect(project.architects.map((a) => [a.name, a.role])).toEqual([
      ["Atelier Vento", "Lead architect"],
      ["Casa Aurora", "Landscape"],
    ]);
    expect(project).toMatchObject({ year: 2024, type: "residential", location: { city: "Lisbon" } });
    expect(project.descriptionMd).toContain("roof garden");
  });

  it("treats a draft as not found", async () => {
    expect(await getProjectPage(db, DRAFT_SLUG)).toEqual({ kind: "not-found" });
  });

  it("returns not-found for an unknown slug", async () => {
    expect(await getProjectPage(db, "does-not-exist")).toEqual({ kind: "not-found" });
  });

  it("redirects a renamed slug to the current one", async () => {
    const [target] = await db.select().from(projects).where(eq(projects.slug, "harbour-light-library"));
    await db.insert(projectSlugRedirects).values({ oldSlug: "old-harbour-name", projectId: target!.id });

    expect(await getProjectPage(db, "old-harbour-name")).toEqual({ kind: "redirect", slug: "harbour-light-library" });
  });

  it("does not redirect to a draft", async () => {
    const [draft] = await db.select().from(projects).where(eq(projects.slug, DRAFT_SLUG));
    await db.insert(projectSlugRedirects).values({ oldSlug: "old-draft-name", projectId: draft!.id });

    expect(await getProjectPage(db, "old-draft-name")).toEqual({ kind: "not-found" });
  });
});

describe("getFilterOptions", () => {
  it("offers only types that have a published project, in editorial order", async () => {
    const { types } = await getFilterOptions(db);

    expect(types).not.toContain("commercial"); // only the draft is commercial
    expect(types).toEqual(PROJECT_TYPES.filter((t) => PUBLISHED.some((p) => p.type === t)));
  });

  it("lists countries with labels and published counts, sorted by name", async () => {
    const { locations } = await getFilterOptions(db);

    expect(locations).toHaveLength(8);
    expect(locations.find((l) => l.code === "DK")).toEqual({ code: "DK", label: "Denmark", count: 1 });
    const labels = locations.map((l) => l.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });

  it("lists distinct years newest first", async () => {
    const { years } = await getFilterOptions(db);

    expect(years).toEqual([2027, 2026, 2025, 2024, 2023, 2022, 2021]);
  });
});

describe("seeded slug redirect", () => {
  it("redirects a project's previous slug to its current one", async () => {
    expect(await getProjectPage(db, "harbour-library")).toEqual({ kind: "redirect", slug: "harbour-light-library" });
  });
});

describe("getRelatedProjects", () => {
  it("returns other published projects, never the project itself or a draft", async () => {
    const related = await getRelatedProjects(db, "harbour-light-library");

    expect(related).toHaveLength(3);
    expect(slugs(related)).not.toContain("harbour-light-library");
    expect(slugs(related)).not.toContain(DRAFT_SLUG);
  });

  it("respects the limit", async () => {
    expect(await getRelatedProjects(db, "harbour-light-library", 2)).toHaveLength(2);
  });

  it("fills with the newest other projects when nothing is related", async () => {
    // No other cultural project and no other Danish one is published, so it falls back to newest.
    const related = await getRelatedProjects(db, "harbour-light-library");

    expect(related[0]!.slug).toBe("yarra-market-quarter");
    const years = related.map((r) => r.year);
    expect(years).toEqual([...years].sort((a, b) => b - a));
  });

  it("puts a project of the same type first, even when it is much older", async () => {
    const [old] = await db
      .insert(projects)
      .values({
        slug: "old-cultural",
        title: "Old Cultural",
        summary: "An older cultural project.",
        type: "cultural",
        year: 1990,
        city: "Rome",
        countryCode: "IT",
        status: "published",
        publishedAt: new Date(),
      })
      .returning();

    const related = await getRelatedProjects(db, "harbour-light-library");
    await db.delete(projects).where(eq(projects.id, old!.id));

    expect(related[0]!.slug).toBe("old-cultural");
  });

  it("ranks the same country above unrelated projects", async () => {
    const [local] = await db
      .insert(projects)
      .values({
        slug: "local-neighbour",
        title: "Local Neighbour",
        summary: "A Japanese project of another type.",
        type: "commercial",
        year: 1995,
        city: "Tokyo",
        countryCode: "JP",
        status: "published",
        publishedAt: new Date(),
      })
      .returning();

    const related = await getRelatedProjects(db, "kansai-timber-school");
    await db.delete(projects).where(eq(projects.id, local!.id));

    expect(related[0]!.slug).toBe("local-neighbour");
  });

  it("returns nothing for an unknown or unpublished project", async () => {
    expect(await getRelatedProjects(db, "does-not-exist")).toEqual([]);
    expect(await getRelatedProjects(db, DRAFT_SLUG)).toEqual([]);
  });
});

describe("getSitemapEntries", () => {
  it("returns every published project with a real update time, and never a draft", async () => {
    const entries = await getSitemapEntries(db);

    expect(entries.map((e) => e.slug)).toEqual(PUBLISHED.map((p) => p.slug).sort());
    expect(entries.map((e) => e.slug)).not.toContain(DRAFT_SLUG);
    for (const entry of entries) {
      expect(entry.updatedAt).toBeInstanceOf(Date);
      expect(Number.isNaN(entry.updatedAt.getTime())).toBe(false);
    }
  });
});

describe("getPublishedSlugs", () => {
  it("returns every published slug, sorted, excluding drafts", async () => {
    const result = await getPublishedSlugs(db);

    expect(result).toEqual(PUBLISHED.map((p) => p.slug).sort());
    expect(result).not.toContain(DRAFT_SLUG);
  });
});
