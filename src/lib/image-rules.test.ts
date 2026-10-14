import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { IMAGE_TYPES, imagePath, isImageType, parseImageMeta, parseTempPath, tempPath } from "./image-rules";

describe("isImageType", () => {
  it("accepts the four formats and nothing else", () => {
    for (const type of IMAGE_TYPES) expect(isImageType(type)).toBe(true);
    for (const type of ["image/svg+xml", "image/gif", "text/html", "application/pdf", "", "IMAGE/JPEG"]) {
      expect(isImageType(type), type).toBe(false);
    }
  });
});

describe("parseImageMeta", () => {
  it("requires alt text and trims everything, turning blank caption and credit into null", () => {
    expect(parseImageMeta({ alt: "  A facade  ", caption: " ", credit: " Jo " })).toEqual({
      ok: true,
      data: { alt: "A facade", caption: null, credit: "Jo" },
    });
  });

  it.each([
    [{ alt: "" }, "alt", "Describe the image for people who cannot see it."],
    [{ alt: "   " }, "alt", "Describe the image for people who cannot see it."],
    [{ alt: "x".repeat(301) }, "alt", "Description must be 300 characters or fewer."],
    [{ alt: "ok", caption: "x".repeat(301) }, "caption", "Caption must be 300 characters or fewer."],
    [{ alt: "ok", credit: "x".repeat(151) }, "credit", "Credit must be 150 characters or fewer."],
  ])("rejects %j", (input, field, message) => {
    const result = parseImageMeta(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[field as "alt"]).toBe(message);
  });

  it("rejects a missing alt and non-object input", () => {
    for (const raw of [{}, null, undefined, "x"]) expect(parseImageMeta(raw).ok).toBe(false);
  });
});

describe("temporary and final paths", () => {
  const [project, upload] = [randomUUID(), randomUUID()];

  it("round-trips a temp path", () => {
    expect(parseTempPath(tempPath(project, upload))).toEqual({ projectId: project, uploadId: upload });
  });

  it.each([
    "projects/x/y.webp",
    "tmp/../../etc/passwd",
    "tmp/abc/def",
    `tmp/${randomUUID()}`,
    `tmp/${randomUUID()}/${randomUUID()}/extra`,
    `/tmp/${randomUUID()}/${randomUUID()}`,
    `tmp/${randomUUID()}/${randomUUID()}.webp`,
    "",
  ])("does not treat %j as a temp path", (path) => {
    expect(parseTempPath(path)).toBeNull();
  });

  it("stores final images by project id, so a rename cannot orphan files", () => {
    expect(imagePath("p1", "i1")).toBe("projects/p1/i1.webp");
  });
});
