// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { makePlaceholderImage, placeholderSize } from "./placeholder-image";

describe("makePlaceholderImage", () => {
  it("produces a WebP of the declared size", async () => {
    const image = await makePlaceholderImage("demo", 0);

    const meta = await sharp(image.data).metadata();
    expect(meta.format).toBe("webp");
    expect({ width: meta.width, height: meta.height }).toEqual({ width: image.width, height: image.height });
  });

  it("is deterministic for the same key and differs between keys", async () => {
    const a1 = await makePlaceholderImage("a", 0);
    const a2 = await makePlaceholderImage("a", 0);
    const b = await makePlaceholderImage("b", 0);

    expect(a1.data.equals(a2.data)).toBe(true);
    expect(a1.data.equals(b.data)).toBe(false);
  });

  it("makes every third image portrait for mixed aspect ratios", () => {
    expect(placeholderSize(0).width).toBeGreaterThan(placeholderSize(0).height);
    expect(placeholderSize(2).width).toBeLessThan(placeholderSize(2).height);
  });

  it("returns a small base64 blur placeholder", async () => {
    const image = await makePlaceholderImage("demo", 1);

    expect(image.blurDataUrl).toMatch(/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/);
    expect(image.blurDataUrl.length).toBeLessThan(2000);
  });
});
