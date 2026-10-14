import { describe, expect, it } from "vitest";
import { formDataToArchitectInput, parseArchitectInput } from "./architect-schema";

const valid = { name: "Ada Okafor", slug: "ada-okafor", websiteUrl: "", bio: "" };
const errorsFor = (overrides: Record<string, unknown>) => {
  const result = parseArchitectInput({ ...valid, ...overrides });
  return result.ok ? {} : result.errors;
};

describe("parseArchitectInput", () => {
  it("accepts a name and address, turning blank optional fields into null", () => {
    expect(parseArchitectInput(valid)).toMatchObject({ ok: true, data: { websiteUrl: null, bio: null } });
  });

  it("trims text and keeps a full website and biography", () => {
    expect(
      parseArchitectInput({ ...valid, name: "  Ada ", websiteUrl: " https://ada.example/work ", bio: " Hello " }),
    ).toMatchObject({ ok: true, data: { name: "Ada", websiteUrl: "https://ada.example/work", bio: "Hello" } });
  });

  it.each([
    ["name", { name: "  " }, "Enter a name."],
    ["name", { name: "x".repeat(121) }, "Name must be 120 characters or fewer."],
    ["slug", { slug: "" }, "Enter a web address."],
    ["slug", { slug: "Not Valid" }, "Use lower-case letters, numbers and single hyphens, up to 80 characters."],
    ["bio", { bio: "x".repeat(2001) }, "Biography must be 2000 characters or fewer."],
  ])("rejects an invalid %s", (field, override, message) => {
    expect(errorsFor(override)[field as "name"]).toBe(message);
  });

  it.each(["javascript:alert(1)", "data:text/html,<b>x</b>", "ftp://x.example", "ada.example", "//ada.example", "not a url"])(
    "rejects the website %j, so no unsafe address can become a link",
    (websiteUrl) => {
      expect(errorsFor({ websiteUrl }).websiteUrl).toBe("Enter a full website address starting with https://");
    },
  );

  it("accepts http and https websites", () => {
    expect(parseArchitectInput({ ...valid, websiteUrl: "http://ada.example" })).toMatchObject({ ok: true });
    expect(parseArchitectInput({ ...valid, websiteUrl: "https://ada.example" })).toMatchObject({ ok: true });
  });

  it("rejects an over-long website and non-object input", () => {
    expect(errorsFor({ websiteUrl: `https://a.example/${"x".repeat(300)}` }).websiteUrl).toBe(
      "Website must be 300 characters or fewer.",
    );
    for (const raw of [null, undefined, "x", 5]) expect(parseArchitectInput(raw)).toMatchObject({ ok: false });
  });
});

describe("formDataToArchitectInput", () => {
  it("reads the four fields as text, and files or missing fields as empty text", () => {
    const data = new FormData();
    data.append("name", "Ada");
    data.append("bio", new File(["x"], "evil.txt"));

    expect(formDataToArchitectInput(data)).toEqual({ name: "Ada", slug: "", websiteUrl: "", bio: "" });
  });
});
