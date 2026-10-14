import { describe, expect, it } from "vitest";
import { hasActiveFilters, parseProjectFilters, serializeProjectFilters } from "./filters";

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
