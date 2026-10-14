// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { IMAGE_LIMITS } from "@/lib/image-rules";
import { ImageRejected, processImage } from "./process-image";

const solid = (width: number, height: number, format: "jpeg" | "png" | "webp" | "avif" = "jpeg") =>
  sharp({ create: { width, height, channels: 3, background: "#3366aa" } })
    [format]()
    .toBuffer();

describe("processImage", () => {
  it.each(["jpeg", "png", "webp", "avif"] as const)("re-encodes a %s as WebP and reads its size", async (format) => {
    const result = await processImage(await solid(400, 300, format));

    const meta = await sharp(result.data).metadata();
    expect(meta.format).toBe("webp");
    expect([result.width, result.height]).toEqual([400, 300]);
    expect([meta.width, meta.height]).toEqual([400, 300]);
  });

  it("shrinks a large picture to the longest-side limit, keeping its proportions, and never enlarges", async () => {
    const big = await processImage(await solid(4800, 2400));
    const small = await processImage(await solid(100, 50));

    expect([big.width, big.height]).toEqual([IMAGE_LIMITS.maxSide, 1200]);
    expect([small.width, small.height]).toEqual([100, 50]);
  });

  it("applies the camera orientation, so a rotated photo ends up upright", async () => {
    const rotated = await sharp({ create: { width: 200, height: 100, channels: 3, background: "#aa3333" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const result = await processImage(rotated);

    expect([result.width, result.height]).toEqual([100, 200]);
  });

  it("strips location and other metadata", async () => {
    const withExif = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#222" } })
      .jpeg()
      .withExif({ IFD0: { Copyright: "secret-owner", ImageDescription: "private place" } })
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const result = await processImage(withExif);

    expect((await sharp(result.data).metadata()).exif).toBeUndefined();
    expect(result.data.toString("latin1")).not.toContain("secret-owner");
  });

  it("makes a tiny blur placeholder data URL", async () => {
    const { blurDataUrl } = await processImage(await solid(800, 600));

    expect(blurDataUrl).toMatch(/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/);
    expect(blurDataUrl.length).toBeLessThan(2000);
  });

  it("judges by the bytes, not the name: an SVG is refused even if it is called a JPEG", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');

    await expect(processImage(svg)).rejects.toThrow(ImageRejected);
  });

  it("refuses a GIF, plain text, HTML, an empty file and a truncated image", async () => {
    const gif = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } }).gif().toBuffer();
    const valid = await solid(600, 400);

    for (const bad of [gif, Buffer.from("hello world"), Buffer.from("<html><body>x</body></html>"), Buffer.alloc(0), valid.subarray(0, 60)]) {
      await expect(processImage(bad)).rejects.toThrow(ImageRejected);
    }
  });

  it("gives messages that are safe to show the admin", async () => {
    await expect(processImage(Buffer.from("hello"))).rejects.toThrow(/could not be read as an image|Only JPEG/);
    await expect(processImage(Buffer.alloc(0))).rejects.toThrow("The file is empty.");
  });

  it("refuses a file over the size limit before decoding it", async () => {
    await expect(processImage(Buffer.alloc(IMAGE_LIMITS.maxBytes + 1))).rejects.toThrow("larger than 30 MB");
  });
});
