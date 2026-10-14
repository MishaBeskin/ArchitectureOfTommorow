import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PROJECT_LIMITS, formDataToProjectInput, parseProjectInput } from "./project-schema";

const valid = {
  title: "Harbour Light Library",
  slug: "harbour-light-library",
  summary: "A public library.",
  descriptionMd: "Some **markdown**.",
  type: "cultural",
  phase: "completed",
  year: "2025",
  city: "Copenhagen",
  region: "",
  countryCode: "DK",
  lat: "",
  lng: "",
  seoTitle: "",
  seoDescription: "",
  architects: [],
};

const errorsFor = (overrides: Record<string, unknown>) => {
  const result = parseProjectInput({ ...valid, ...overrides });
  return result.ok ? {} : result.errors;
};

describe("parseProjectInput", () => {
  it("accepts a complete project and converts the text fields to their types", () => {
    const result = parseProjectInput(valid);

    expect(result).toMatchObject({
      ok: true,
      data: { title: "Harbour Light Library", year: 2025, region: null, lat: null, lng: null, seoTitle: null, architects: [] },
    });
  });

  it("trims text, keeps the description exactly as written, and turns blank optional fields into null", () => {
    const result = parseProjectInput({
      ...valid,
      title: "  Padded  ",
      summary: "  s  ",
      descriptionMd: "  keep  \n\n  spaces  ",
      region: "  Zealand ",
      seoTitle: "   ",
    });

    expect(result).toMatchObject({
      ok: true,
      data: { title: "Padded", summary: "s", descriptionMd: "  keep  \n\n  spaces  ", region: "Zealand", seoTitle: null },
    });
  });

  it("allows an empty summary, since a draft may not have one yet", () => {
    expect(parseProjectInput({ ...valid, summary: "" })).toMatchObject({ ok: true });
  });

  it.each([
    ["title", { title: "   " }, "Enter a title."],
    ["title", { title: "x".repeat(PROJECT_LIMITS.title + 1) }, "Title must be 120 characters or fewer."],
    ["slug", { slug: "" }, "Enter a web address."],
    ["slug", { slug: "Not Valid" }, "Use lower-case letters, numbers and single hyphens, up to 80 characters."],
    ["slug", { slug: "double--hyphen" }, "Use lower-case letters, numbers and single hyphens, up to 80 characters."],
    ["summary", { summary: "x".repeat(301) }, "Summary must be 300 characters or fewer."],
    ["descriptionMd", { descriptionMd: "x".repeat(20_001) }, "Description must be 20000 characters or fewer."],
    ["type", { type: "castle" }, "Choose a type."],
    ["type", { type: "" }, "Choose a type."],
    ["phase", { phase: "someday" }, "Choose a stage."],
    ["city", { city: "" }, "Enter a city."],
    ["countryCode", { countryCode: "" }, "Choose a country."],
    ["countryCode", { countryCode: "XX" }, "Choose a country."],
    ["countryCode", { countryCode: "dk" }, "Choose a country."],
    ["seoTitle", { seoTitle: "x".repeat(71) }, "Search title must be 70 characters or fewer."],
    ["seoDescription", { seoDescription: "x".repeat(161) }, "Search description must be 160 characters or fewer."],
    ["region", { region: "x".repeat(101) }, "Region must be 100 characters or fewer."],
  ])("rejects an invalid %s", (field, override, message) => {
    expect(errorsFor(override)[field as keyof ReturnType<typeof errorsFor>]).toBe(message);
  });

  it.each([
    ["", "Enter a year."],
    ["abc", "Enter a year."],
    ["1899", "Enter a year between 1900 and 2100."],
    ["2101", "Enter a year between 1900 and 2100."],
    ["2025.5", "Enter a whole year."],
  ])("rejects the year %j", (year, message) => {
    expect(errorsFor({ year }).year).toBe(message);
  });

  it("accepts the boundary years", () => {
    expect(parseProjectInput({ ...valid, year: "1900" })).toMatchObject({ ok: true });
    expect(parseProjectInput({ ...valid, year: "2100" })).toMatchObject({ ok: true });
  });

  it("parses coordinates, and requires both or neither", () => {
    expect(parseProjectInput({ ...valid, lat: "55.6761", lng: "12.5683" })).toMatchObject({
      ok: true,
      data: { lat: 55.6761, lng: 12.5683 },
    });
    expect(errorsFor({ lat: "55.6", lng: "" }).lng).toBe("Give both latitude and longitude, or leave both empty.");
    expect(errorsFor({ lat: "", lng: "12.5" }).lat).toBe("Give both latitude and longitude, or leave both empty.");
  });

  it("rejects coordinates that are not numbers or are out of range", () => {
    expect(errorsFor({ lat: "north", lng: "12" }).lat).toBe("Latitude must be a number.");
    expect(errorsFor({ lat: "91", lng: "12" }).lat).toBe("Latitude must be between -90 and 90.");
    expect(errorsFor({ lat: "10", lng: "181" }).lng).toBe("Longitude must be between -180 and 180.");
    expect(parseProjectInput({ ...valid, lat: "-90", lng: "-180" })).toMatchObject({ ok: true });
  });

  it("reports every invalid field at once, one message each", () => {
    const errors = errorsFor({ title: "", slug: "BAD", year: "", city: "", countryCode: "" });

    expect(Object.keys(errors).sort()).toEqual(["city", "countryCode", "slug", "title", "year"]);
  });

  it("rejects input that is not an object, and missing fields", () => {
    for (const raw of [null, undefined, "x", 5, []]) expect(parseProjectInput(raw)).toMatchObject({ ok: false });
    expect(parseProjectInput({})).toMatchObject({ ok: false });
  });

  describe("architect credits", () => {
    const [a, b] = [randomUUID(), randomUUID()];

    it("accepts credits with and without a role, trimming roles and blanking empty ones", () => {
      const result = parseProjectInput({
        ...valid,
        architects: [
          { architectId: a, role: "  Lead architect " },
          { architectId: b, role: "" },
        ],
      });

      expect(result).toMatchObject({
        ok: true,
        data: {
          architects: [
            { architectId: a, role: "Lead architect" },
            { architectId: b, role: null },
          ],
        },
      });
    });

    it("rejects an id that is not a UUID", () => {
      expect(errorsFor({ architects: [{ architectId: "not-a-uuid", role: "" }] }).architects).toBe(
        "Choose an architect from the list.",
      );
    });

    it("rejects crediting the same architect twice", () => {
      expect(
        errorsFor({ architects: [{ architectId: a, role: "" }, { architectId: a, role: "Landscape" }] }).architects,
      ).toBe("Each architect can be credited only once.");
    });

    it("rejects an over-long role", () => {
      expect(errorsFor({ architects: [{ architectId: a, role: "r".repeat(101) }] }).architects).toBe(
        "Role must be 100 characters or fewer.",
      );
    });
  });
});

describe("formDataToProjectInput", () => {
  function form(entries: Array<[string, string]>) {
    const data = new FormData();
    for (const [key, value] of entries) data.append(key, value);
    return data;
  }

  it("reads every field as text and passes the result straight into the schema", () => {
    const data = form([
      ["title", "T"],
      ["slug", "t"],
      ["summary", "S"],
      ["descriptionMd", "D"],
      ["type", "civic"],
      ["phase", "concept"],
      ["year", "2026"],
      ["city", "Nairobi"],
      ["region", ""],
      ["countryCode", "KE"],
      ["lat", ""],
      ["lng", ""],
      ["seoTitle", ""],
      ["seoDescription", ""],
    ]);

    expect(parseProjectInput(formDataToProjectInput(data))).toMatchObject({ ok: true, data: { title: "T", year: 2026 } });
  });

  it("collects each credited architect with the role typed next to them", () => {
    const [a, b] = [randomUUID(), randomUUID()];
    const data = form([
      ["architectId", a],
      ["architectId", b],
      [`role-${a}`, "Lead"],
      [`role-${b}`, ""],
    ]);

    expect(formDataToProjectInput(data).architects).toEqual([
      { architectId: a, role: "Lead" },
      { architectId: b, role: "" },
    ]);
  });

  it("ignores a role typed for an architect who is not ticked", () => {
    const [a, b] = [randomUUID(), randomUUID()];
    const data = form([["architectId", a], [`role-${a}`, "Lead"], [`role-${b}`, "Ghost"]]);

    expect(formDataToProjectInput(data).architects).toEqual([{ architectId: a, role: "Lead" }]);
  });

  it("treats missing fields and file uploads as empty text rather than failing", () => {
    const data = new FormData();
    data.append("title", new File(["x"], "evil.txt"));

    expect(formDataToProjectInput(data)).toMatchObject({ title: "", slug: "", architects: [] });
  });
});
