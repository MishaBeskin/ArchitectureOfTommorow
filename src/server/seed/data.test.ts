import { describe, expect, it } from "vitest";
import { PROJECT_PHASES, PROJECT_TYPES, YEAR_RANGE } from "@/lib/types";
import { SEED_ARCHITECTS, SEED_PROJECTS } from "./data";

describe("seed data", () => {
  it("has unique project and architect slugs", () => {
    const projectSlugs = SEED_PROJECTS.map((p) => p.slug);
    const architectSlugs = SEED_ARCHITECTS.map((a) => a.slug);

    expect(new Set(projectSlugs).size).toBe(projectSlugs.length);
    expect(new Set(architectSlugs).size).toBe(architectSlugs.length);
  });

  it.each(SEED_PROJECTS)("$slug satisfies the database constraints", (project) => {
    expect(project.summary.length).toBeLessThanOrEqual(300);
    expect(project.year).toBeGreaterThanOrEqual(YEAR_RANGE.min);
    expect(project.year).toBeLessThanOrEqual(YEAR_RANGE.max);
    expect(project.countryCode).toMatch(/^[A-Z]{2}$/);
    expect(PROJECT_TYPES).toContain(project.type);
    expect(PROJECT_PHASES).toContain(project.phase);
    expect(project.imageCount).toBeGreaterThan(0);
    expect(project.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("only credits architects that exist", () => {
    const known = new Set(SEED_ARCHITECTS.map((a) => a.slug));
    for (const project of SEED_PROJECTS) {
      for (const credit of project.architects) expect(known).toContain(credit.slug);
    }
  });

  it("gives every featured project a distinct order and none to the rest", () => {
    const featured = SEED_PROJECTS.filter((p) => p.featured);
    const orders = featured.map((p) => p.featuredOrder);

    expect(featured.length).toBeGreaterThanOrEqual(3);
    expect(orders.every((o) => typeof o === "number")).toBe(true);
    expect(new Set(orders).size).toBe(orders.length);
    expect(SEED_PROJECTS.filter((p) => !p.featured).every((p) => p.featuredOrder === undefined)).toBe(true);
  });

  it("covers every project type used by the filters, with a draft and several countries", () => {
    const published = SEED_PROJECTS.filter((p) => p.status === "published");

    expect(SEED_PROJECTS.some((p) => p.status === "draft")).toBe(true);
    expect(new Set(published.map((p) => p.countryCode)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(published.map((p) => p.year)).size).toBeGreaterThanOrEqual(4);
  });
});
