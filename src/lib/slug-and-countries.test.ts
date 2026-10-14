import { describe, expect, it } from "vitest";
import { COUNTRY_CODES, countryOptions, isCountryCode } from "./countries";
import { SLUG_MAX_LENGTH, isValidSlug, slugify } from "./slug";

describe("slugify", () => {
  it.each([
    ["Harbour Light Library", "harbour-light-library"],
    ["Terrace Houses, Alfama", "terrace-houses-alfama"],
    ["  Spaces   and\tTabs  ", "spaces-and-tabs"],
    ["Under_scores & Ampersands", "under-scores-and-ampersands"],
    ["Rock & Roll", "rock-and-roll"],
    ["Already-hyphenated--title", "already-hyphenated-title"],
    ["---Edges---", "edges"],
    ["2025 Pavilion", "2025-pavilion"],
    ["UPPER lower MiXeD", "upper-lower-mixed"],
  ])("turns %j into %j", (title, expected) => {
    expect(slugify(title)).toBe(expected);
  });

  it("removes accents instead of dropping the letters under them", () => {
    expect(slugify("Café Münchën Ångström")).toBe("cafe-munchen-angstrom");
  });

  it("drops characters that have no plain equivalent, and gives an empty slug when nothing is left", () => {
    expect(slugify("Tokyo 東京 Tower")).toBe("tokyo-tower");
    expect(slugify("東京")).toBe("");
    expect(slugify("🏛️🏛️")).toBe("");
    expect(slugify("")).toBe("");
    expect(slugify("   ")).toBe("");
  });

  it("never produces a leading, trailing or doubled hyphen, even after truncating", () => {
    const long = `${"word ".repeat(40)}end`;

    const slug = slugify(long);

    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug).not.toMatch(/^-|-$|--/);
    expect(isValidSlug(slug)).toBe(true);
  });

  it("truncates exactly at a word boundary hyphen without leaving it behind", () => {
    const title = `${"a".repeat(SLUG_MAX_LENGTH - 1)} b`;

    expect(slugify(title)).toBe("a".repeat(SLUG_MAX_LENGTH - 1));
  });

  it("always yields a valid slug or an empty string, and is stable when applied twice", () => {
    for (const title of ["A", "a b", "Ünï cödé", "x".repeat(300), "!!!", "1-2-3", "Mixed 東京 text & more"]) {
      const slug = slugify(title);
      if (slug !== "") expect(isValidSlug(slug), title).toBe(true);
      expect(slugify(slug), title).toBe(slug);
    }
  });
});

describe("isValidSlug", () => {
  it.each(["a", "abc", "a-b", "a1-b2-c3", "2025", "x".repeat(SLUG_MAX_LENGTH)])("accepts %j", (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });

  it.each([
    "",
    "-a",
    "a-",
    "a--b",
    "A",
    "a_b",
    "a b",
    "a/b",
    "a.b",
    "../x",
    "é",
    "x".repeat(SLUG_MAX_LENGTH + 1),
  ])("rejects %j", (slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });
});

describe("countries", () => {
  it("lists 249 unique, upper-case two-letter codes", () => {
    expect(COUNTRY_CODES).toHaveLength(249);
    expect(new Set(COUNTRY_CODES).size).toBe(249);
    for (const code of COUNTRY_CODES) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it("gives every code a real English name, which also proves the code is genuine", () => {
    const names = new Intl.DisplayNames(["en"], { type: "region" });

    for (const code of COUNTRY_CODES) {
      const name = names.of(code);
      expect(name, code).toBeTruthy();
      expect(name, code).not.toBe(code);
    }
  });

  it("recognises real codes only, case-sensitively", () => {
    for (const code of ["DK", "JP", "US", "KE", "AU"]) expect(isCountryCode(code)).toBe(true);
    for (const code of ["dk", "XX", "ZZ", "", "DNK", "D", " DK"]) expect(isCountryCode(code), code).toBe(false);
  });

  it("includes every country the sample projects use", () => {
    for (const code of ["DK", "PT", "JP", "KE", "MX", "AU", "NL", "CA"]) expect(isCountryCode(code)).toBe(true);
  });

  it("offers options sorted by English name", () => {
    const options = countryOptions();

    expect(options).toHaveLength(249);
    expect(options.find((o) => o.code === "DK")).toEqual({ code: "DK", name: "Denmark" });
    const names = options.map((o) => o.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});
