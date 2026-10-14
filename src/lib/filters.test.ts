import { describe, expect, it } from "vitest";
import {
  canonicalProjectsHref,
  hasActiveFilters,
  needsCanonicalRedirect,
  parseProjectFilters,
  projectsHref,
  serializeProjectFilters,
} from "./filters";

describe("projectsHref", () => {
  it("is /projects with no filters and appends the canonical query otherwise", () => {
    expect(projectsHref({ page: 1 })).toBe("/projects");
    expect(projectsHref({ page: 2, type: "civic" })).toBe("/projects?type=civic&page=2");
  });
});

describe("needsCanonicalRedirect", () => {
  const check = (raw: Record<string, string | string[] | undefined>) =>
    needsCanonicalRedirect(raw, parseProjectFilters(raw));

  it("is false for canonical and empty URLs", () => {
    expect(check({})).toBe(false);
    expect(check({ type: "civic", location: "DK", year: "2025", page: "2" })).toBe(false);
  });

  it("is true for the empty values a plain GET form sends for 'All'", () => {
    expect(check({ type: "", location: "", year: "" })).toBe(true);
    expect(check({ type: "civic", location: "", year: "" })).toBe(true);
  });

  it("is true for wrong case, page=1, invalid values and repeats", () => {
    expect(check({ location: "dk" })).toBe(true);
    expect(check({ page: "1" })).toBe(true);
    expect(check({ type: "castle" })).toBe(true);
    expect(check({ year: "abc" })).toBe(true);
    expect(check({ type: ["civic", "cultural"] })).toBe(true);
  });

  it("ignores unrelated params so tracking links are not redirected", () => {
    expect(check({ utm_source: "newsletter" })).toBe(false);
  });
});

describe("canonicalProjectsHref", () => {
  const href = (raw: Record<string, string | string[] | undefined>) =>
    canonicalProjectsHref(raw, parseProjectFilters(raw));

  it("drops empty and invalid values", () => {
    expect(href({ type: "", location: "", year: "" })).toBe("/projects");
    expect(href({ type: "civic", location: "", year: "abc" })).toBe("/projects?type=civic");
  });

  it("normalises case and page 1", () => {
    expect(href({ location: "dk", page: "1" })).toBe("/projects?location=DK");
  });

  it("keeps unrelated params, such as utm_source", () => {
    expect(href({ type: "", utm_source: "newsletter" })).toBe("/projects?utm_source=newsletter");
    expect(href({ type: "civic", utm_source: ["a", "b"] })).toBe("/projects?utm_source=a&utm_source=b&type=civic");
  });

  it("is stable: redirecting to the canonical URL never needs another redirect", () => {
    const raw = { type: "", location: "dk", year: "2025", page: "1" };
    const target = new URL(href(raw), "http://x");
    const next = Object.fromEntries(target.searchParams);

    expect(needsCanonicalRedirect(next, parseProjectFilters(next))).toBe(false);
  });
});

describe("parseProjectFilters", () => {
  it("returns page 1 and no filters for empty params", () => {
    expect(parseProjectFilters({})).toEqual({ page: 1 });
  });

  it("parses valid values and upper-cases the country code", () => {
    expect(parseProjectFilters({ type: "cultural", location: "dk", year: "2025", page: "2" })).toEqual({
      type: "cultural",
      location: "DK",
      year: 2025,
      page: 2,
    });
  });

  it("drops unrecognised and malformed values instead of failing", () => {
    expect(
      parseProjectFilters({ type: "castle", location: "Denmark", year: "20x5", page: "-1" }),
    ).toEqual({ page: 1 });
  });

  it.each(["1899", "2101", "99999", "0"])("drops the out-of-range year %s", (year) => {
    expect(parseProjectFilters({ year })).toEqual({ page: 1 });
  });

  it.each(["0", "1001", "abc", "1.5", ""])("falls back to page 1 for page=%j", (page) => {
    expect(parseProjectFilters({ page }).page).toBe(1);
  });

  it("uses the first value when a param is repeated", () => {
    expect(parseProjectFilters({ type: ["civic", "cultural"], year: ["2024", "2025"] })).toEqual({
      page: 1,
      type: "civic",
      year: 2024,
    });
  });

  it("trims whitespace", () => {
    expect(parseProjectFilters({ type: " civic ", location: " pt " })).toMatchObject({
      type: "civic",
      location: "PT",
    });
  });

  it("ignores unrelated params", () => {
    expect(parseProjectFilters({ utm_source: "newsletter", foo: "bar" })).toEqual({ page: 1 });
  });
});

describe("serializeProjectFilters", () => {
  it("produces a canonical query with a fixed key order", () => {
    expect(serializeProjectFilters({ page: 2, year: 2025, type: "civic", location: "DK" })).toBe(
      "type=civic&location=DK&year=2025&page=2",
    );
  });

  it("omits defaults so page 1 and empty filters give an empty string", () => {
    expect(serializeProjectFilters({ page: 1 })).toBe("");
  });

  it("round-trips through parse", () => {
    const filters = { type: "education", location: "JP", year: 2023, page: 3 } as const;

    expect(parseProjectFilters(Object.fromEntries(new URLSearchParams(serializeProjectFilters(filters))))).toEqual(
      filters,
    );
  });
});

describe("hasActiveFilters", () => {
  it("ignores the page number", () => {
    expect(hasActiveFilters({ page: 5 })).toBe(false);
    expect(hasActiveFilters({ page: 1, year: 2024 })).toBe(true);
    expect(hasActiveFilters({ page: 1, type: "civic" })).toBe(true);
    expect(hasActiveFilters({ page: 1, location: "DK" })).toBe(true);
  });
});
