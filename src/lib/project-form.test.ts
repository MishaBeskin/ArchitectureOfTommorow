import { describe, expect, it } from "vitest";
import { emptyProjectForm, formFromSubmittedValues, projectToFormInitial } from "./project-form";

describe("emptyProjectForm", () => {
  it("starts blank, as a completed project in the given year", () => {
    expect(emptyProjectForm(2031)).toMatchObject({ title: "", slug: "", type: "", phase: "completed", year: "2031", credits: [] });
  });
});

describe("projectToFormInitial", () => {
  const row = {
    title: "T",
    slug: "t",
    summary: "S",
    descriptionMd: "D",
    type: "civic",
    phase: "concept",
    year: 2026,
    city: "Nairobi",
    region: null,
    countryCode: "KE",
    lat: -1.29,
    lng: null,
    seoTitle: null,
    seoDescription: "Seo",
  };

  it("turns numbers into text and missing values into empty text", () => {
    expect(projectToFormInitial(row, [])).toMatchObject({
      year: "2026",
      region: "",
      lat: "-1.29",
      lng: "",
      seoTitle: "",
      seoDescription: "Seo",
    });
  });

  it("keeps the credits in order, with a missing role as empty text", () => {
    const credits = [
      { architectId: "b", role: "Lead" },
      { architectId: "a", role: null },
    ];

    expect(projectToFormInitial(row, credits).credits).toEqual([
      { architectId: "b", role: "Lead" },
      { architectId: "a", role: "" },
    ]);
  });
});

describe("formFromSubmittedValues", () => {
  it("returns what was typed", () => {
    const values = { ...emptyProjectForm(2026), title: "Typed", architects: [{ architectId: "x", role: "Lead" }] };

    expect(formFromSubmittedValues(values)).toMatchObject({
      title: "Typed",
      credits: [{ architectId: "x", role: "Lead" }],
    });
  });

  it("falls back to empty text for anything that is not text, and drops malformed credits", () => {
    const result = formFromSubmittedValues({
      title: 5,
      slug: null,
      architects: [null, "x", { architectId: 3 }, { architectId: "ok", role: 9 }],
    });

    expect(result.title).toBe("");
    expect(result.slug).toBe("");
    expect(result.credits).toEqual([{ architectId: "ok", role: "" }]);
  });

  it("copes with no credits at all", () => {
    expect(formFromSubmittedValues({}).credits).toEqual([]);
  });
});
