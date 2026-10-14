import { describe, expect, it } from "vitest";
import { publishProblems } from "./publish-readiness";

const ready = {
  summary: "A short summary.",
  coverImageId: "a",
  images: [
    { id: "a", alt: "Facade at dusk" },
    { id: "b", alt: "Atrium" },
  ],
};

describe("publishProblems", () => {
  it("reports nothing for a project that is ready", () => {
    expect(publishProblems(ready)).toEqual([]);
  });

  it("asks for a summary, and treats whitespace as empty", () => {
    expect(publishProblems({ ...ready, summary: "" })).toEqual(["Add a summary."]);
    expect(publishProblems({ ...ready, summary: "  \n " })).toEqual(["Add a summary."]);
  });

  it("asks for an image when there are none, and does not also nag about a cover or alt text", () => {
    expect(publishProblems({ ...ready, images: [], coverImageId: null })).toEqual(["Add at least one image."]);
  });

  it("asks for a cover when none is chosen", () => {
    expect(publishProblems({ ...ready, coverImageId: null })).toEqual(["Choose a cover image."]);
  });

  it("asks for a cover when the chosen one is not among the images", () => {
    expect(publishProblems({ ...ready, coverImageId: "deleted-image" })).toEqual(["Choose a cover image."]);
  });

  it("counts images without alt text, in singular and plural, treating whitespace as missing", () => {
    expect(publishProblems({ ...ready, images: [{ id: "a", alt: "ok" }, { id: "b", alt: "   " }] })).toEqual([
      "One image is missing its alt text.",
    ]);
    expect(publishProblems({ ...ready, images: [{ id: "a", alt: "" }, { id: "b", alt: "" }] })).toEqual([
      "2 images are missing their alt text.",
    ]);
  });

  it("lists every problem at once, so they can all be fixed in one go", () => {
    expect(
      publishProblems({ summary: "", coverImageId: null, images: [{ id: "a", alt: "" }] }),
    ).toEqual(["Add a summary.", "Choose a cover image.", "One image is missing its alt text."]);
  });
});
