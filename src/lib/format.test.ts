import { describe, expect, it } from "vitest";
import { countryName, formatLocation, formatPhase, formatProjectType } from "./format";

describe("formatPhase", () => {
  it("turns every phase into readable text", () => {
    expect(formatPhase("concept")).toBe("Concept");
    expect(formatPhase("in-progress")).toBe("In progress");
    expect(formatPhase("completed")).toBe("Completed");
  });
});

describe("formatProjectType", () => {
  it("capitalises the first letter and keeps hyphens", () => {
    expect(formatProjectType("residential")).toBe("Residential");
    expect(formatProjectType("mixed-use")).toBe("Mixed-use");
  });
});

describe("countryName", () => {
  it("returns the English name for a country code", () => {
    expect(countryName("DK")).toBe("Denmark");
    expect(countryName("JP")).toBe("Japan");
  });

  it("falls back to the code when it is not a valid region code", () => {
    expect(countryName("ZZZZ")).toBe("ZZZZ");
  });
});

describe("formatLocation", () => {
  it("joins city and country", () => {
    expect(formatLocation({ city: "Copenhagen", region: null, countryCode: "DK" })).toBe("Copenhagen, Denmark");
  });

  it("includes the region when present", () => {
    expect(formatLocation({ city: "Vancouver", region: "British Columbia", countryCode: "CA" })).toBe(
      "Vancouver, British Columbia, Canada",
    );
  });
});
