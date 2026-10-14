import { describe, expect, it } from "vitest";
import { projectFixture } from "@/test/fixtures";
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  projectJsonLd,
  serializeJsonLd,
  websiteJsonLd,
} from "./json-ld";

const SITE = "https://x.test";

describe("organization and website", () => {
  it("identify the site with schema.org types", () => {
    expect(organizationJsonLd(SITE)).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Architecture of Tomorrow",
      url: SITE,
    });
    expect(websiteJsonLd(SITE)).toMatchObject({ "@type": "WebSite", url: SITE, inLanguage: "en" });
  });
});

describe("breadcrumbJsonLd", () => {
  it("numbers items from 1 and makes every URL absolute", () => {
    const data = breadcrumbJsonLd(SITE, [
      { name: "Home", path: "/" },
      { name: "Projects", path: "/projects" },
      { name: "Harbour", path: "/projects/harbour" },
    ]);

    expect(data["@type"]).toBe("BreadcrumbList");
    expect(data.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "https://x.test/" },
      { "@type": "ListItem", position: 2, name: "Projects", item: "https://x.test/projects" },
      { "@type": "ListItem", position: 3, name: "Harbour", item: "https://x.test/projects/harbour" },
    ]);
  });
});

describe("projectJsonLd", () => {
  it("describes the project as a CreativeWork with its facts", () => {
    const data = projectJsonLd(SITE, projectFixture());

    expect(data).toMatchObject({
      "@type": "CreativeWork",
      "@id": "https://x.test/projects/harbour-light-library",
      url: "https://x.test/projects/harbour-light-library",
      name: "Harbour Light Library",
      description: "A public library on the waterfront.",
      genre: "Cultural",
      dateCreated: "2025",
      inLanguage: "en",
    });
    expect(data.creator).toEqual([{ "@type": "Organization", name: "Studio Nordlys" }]);
    expect(data.image).toHaveLength(2);
    expect(data.locationCreated).toMatchObject({
      "@type": "Place",
      name: "Copenhagen",
      address: { "@type": "PostalAddress", addressLocality: "Copenhagen", addressCountry: "DK" },
    });
  });

  it("includes the architect's website, region and coordinates only when known", () => {
    const base = projectFixture();
    const data = projectJsonLd(SITE, {
      ...base,
      architects: [{ ...base.architects[0]!, websiteUrl: "https://studio.example" }],
      location: { city: "Vancouver", region: "British Columbia", countryCode: "CA", lat: 49.28, lng: -123.12 },
    });

    expect(data.creator).toEqual([
      { "@type": "Organization", name: "Studio Nordlys", url: "https://studio.example" },
    ]);
    expect(data.locationCreated).toMatchObject({
      address: { addressRegion: "British Columbia" },
      geo: { "@type": "GeoCoordinates", latitude: 49.28, longitude: -123.12 },
    });
  });

  it("omits creator, images and dates that do not exist", () => {
    const data = projectJsonLd(SITE, projectFixture({ architects: [], images: [], publishedAt: null }));

    expect(data).not.toHaveProperty("creator");
    expect(data).not.toHaveProperty("image");
    expect(data).not.toHaveProperty("datePublished");
    expect(JSON.stringify(data)).not.toContain("undefined");
  });
});

describe("serializeJsonLd", () => {
  it("produces JSON that parses back to the same data", () => {
    const data = { a: 1, nested: { list: ["x", "y"], text: "plain" } };

    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  it("cannot be broken out of its script tag by text from the admin", () => {
    const hostile = projectJsonLd(SITE, projectFixture({ title: '</script><script>alert("x")</script>' }));

    const out = serializeJsonLd(hostile);

    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(JSON.parse(out).name).toBe('</script><script>alert("x")</script>');
  });

  it("escapes the line and paragraph separators JavaScript treats as newlines", () => {
    const separators = String.fromCharCode(0x2028) + String.fromCharCode(0x2029);

    const out = serializeJsonLd({ text: `a${separators}b` });

    expect(out).not.toContain(String.fromCharCode(0x2028));
    expect(out).not.toContain(String.fromCharCode(0x2029));
    expect(JSON.parse(out).text).toBe(`a${separators}b`);
  });

  it("serialises several documents as one JSON array", () => {
    const out = serializeJsonLd([organizationJsonLd(SITE), websiteJsonLd(SITE)]);

    expect(JSON.parse(out).map((d: { "@type": string }) => d["@type"])).toEqual(["Organization", "WebSite"]);
  });
});
